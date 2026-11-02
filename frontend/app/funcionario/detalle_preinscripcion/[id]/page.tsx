'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import DocumentAnalysis, { type DocumentAnalysisData } from '@/app/components/document_analysis/DocumentAnalysis';
import Navbar from '@/app/components/navbar/Navbar';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Dialog from '@/app/components/ui/Dialog';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';
import { InformacionEstudiante } from '@/app/components/informacion_estudiante';
import { useSesion } from '@/app/lib/useSesion';
import { etiquetaPropiedad, valorVisible } from '@/app/estudiante/preinscripcion/etiquetas';
import type { DocumentoSolicitud } from '@/app/estudiante/preinscripcion/types';
import { obtenerDetalle, registrarRevision, resolverDocumento, type AccionRevision, type DetalleFuncionaria } from '../../solicitudes-api';
import styles from './detalle.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const ACCIONES: Record<AccionRevision, string> = {
    comentario: 'Enviar comentario', recarga: 'Solicitar corrección', aceptada: 'Aceptar solicitud', anulada: 'Anular solicitud',
};
const RESULTADOS: Record<string, string> = {
    APROBADA: 'Solicitud aceptada', RECHAZADA: 'Solicitud anulada',
    CORRECCION_REQUERIDA: 'Corrección solicitada', POR_REVISAR: 'Comentario',
    DOCUMENTO_RESUELTO: 'Documento resuelto',
};
const ESTADOS: Record<string, string> = {
    BORRADOR: 'Borrador', EN_PROCESO: 'En proceso', POR_REVISAR: 'Por revisar',
    VALIDA: 'Válida', ACEPTADA: 'Aceptada', CERRADA: 'Anulada', CANCELADA: 'Cancelada', NO_VALIDA: 'No válida', INCONSISTENTE: 'Inconsistente',
};
type Resolucion = { documento: DocumentoSolicitud; resultado: 'VALIDO' | 'NO_VALIDO' };
function estadoDocumento(doc: DocumentoSolicitud) {
    return doc.resultados.find(r => r.estado === 'no_valido' || r.estado === 'inconsistente')?.estado ?? doc.resultados[0]?.estado ?? 'por_revisar';
}
function analisisPersistido(doc: DocumentoSolicitud): DocumentAnalysisData {
    const estados = { valido: 'VALIDO', no_valido: 'NO_VALIDO', inconsistente: 'INCONSISTENTE', por_revisar: 'POR_REVISAR' } as const;
    return {
        documentType: doc.nombre, fileName: doc.fileName ?? doc.nombre, status: estados[estadoDocumento(doc)],
        privateDocumentUrl: doc.archivoDisponible && doc.id ? `${API}/funcionario/documentos/${encodeURIComponent(doc.id)}/original` : undefined,
        extractedFields: Object.entries(doc.analisis?.extracted_data ?? {}).map(([campo, dato], i) => ({
            label: etiquetaPropiedad(campo, i), value: valorVisible(dato.value), source: 'Análisis documental registrado',
        })),
        validations: doc.resultados.map(r => ({ description: r.mensaje, result: r.estado === 'por_revisar' ? null : r.estado === 'valido' })),
    };
}
export default function DetallePreinscripcionPage() {
    const { id } = useParams<{ id: string }>();
    return <DetalleSolicitud key={id} id={id} />;
}
function DetalleSolicitud({id}: {id: string}) {
    const { usuario, cargando } = useSesion('funcionario');
    const [detalle, setDetalle] = useState<DetalleFuncionaria | null>(null);
    const [error, setError] = useState('');
    const [intento, setIntento] = useState(0);
    const [analisis, setAnalisis] = useState<DocumentAnalysisData | null>(null);
    const [accion, setAccion] = useState<AccionRevision>('comentario');
    const [comentario, setComentario] = useState('');
    const [seleccionados, setSeleccionados] = useState<number[]>([]);
    const [confirmando, setConfirmando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [requiereConsulta, setRequiereConsulta] = useState(false);
    const [resolucion, setResolucion] = useState<Resolucion | null>(null);
    const [motivo, setMotivo] = useState('');
    const [errorResolucion, setErrorResolucion] = useState('');
    const ocupado = useRef(false);
    const vigente = useRef(true);
    useEffect(() => { vigente.current = true; return () => { vigente.current = false; }; }, []);
    useEffect(() => {
        if (!usuario) return;
        const controlador = new AbortController();
        obtenerDetalle(id, controlador.signal).then(data => {
            if (!controlador.signal.aborted) { setDetalle(data); setError(''); setRequiereConsulta(false); }
        }).catch(e => { if (!controlador.signal.aborted) setError(e instanceof Error ? e.message : 'No fue posible consultar la solicitud.'); });
        return () => controlador.abort();
    }, [usuario, id, intento]);

    const corregibles = detalle?.documentos.filter(d => estadoDocumento(d) !== 'valido') ?? [];
    // Tarea 42a: ACEPTADA, CERRADA y CANCELADA son finales; solo se acepta una solicitud VALIDA.
    const admiteDecision = !!detalle && !['BORRADOR', 'ACEPTADA', 'CERRADA', 'CANCELADA'].includes(detalle.estadoSolicitud);
    const admiteAceptar = admiteDecision && detalle?.estadoSolicitud === 'VALIDA';
    const admiteRecarga = admiteDecision && detalle?.estadoSolicitud !== 'VALIDA' && corregibles.length > 0;
    function abrirResolucion(documento: DocumentoSolicitud, resultado: Resolucion['resultado']) {
        setMotivo(''); setErrorResolucion(''); setMensaje(''); setResolucion({ documento, resultado });
    }
    async function confirmarResolucion() {
        if (!resolucion?.documento.id || ocupado.current) return;
        if (resolucion.resultado === 'NO_VALIDO' && !motivo.trim()) { setErrorResolucion('Escribe el motivo.'); return; }
        ocupado.current = true; setEnviando(true); setErrorResolucion('');
        try {
            await resolverDocumento(resolucion.documento.id, resolucion.resultado, motivo.trim());
            if (!vigente.current) return;
            setResolucion(null);
            setMensaje('Documento resuelto. La notificación del estudiante quedó guardada.');
            const nuevo = await obtenerDetalle(id);
            if (vigente.current) { setDetalle(nuevo); setError(''); }
        } catch (e) {
            if (vigente.current) setErrorResolucion(e instanceof Error ? e.message : 'No se pudo resolver el documento.');
        } finally {
            ocupado.current = false;
            if (vigente.current) setEnviando(false);
        }
    }
    function preparar(evento: FormEvent) {
        evento.preventDefault(); setErrorEnvio(''); setMensaje('');
        if (accion === 'comentario' && !comentario.trim()) { setErrorEnvio('Escribe el comentario.'); return; }
        if (accion === 'recarga' && !seleccionados.length) { setErrorEnvio('Selecciona al menos un documento.'); return; }
        setConfirmando(true);
    }
    async function enviar() {
        if (ocupado.current || requiereConsulta) return;
        ocupado.current = true; setEnviando(true); setErrorEnvio('');
        let guardado = false;
        try {
            await registrarRevision(id, accion, comentario.trim(), seleccionados);
            guardado = true;
            if (!vigente.current) return;
            setConfirmando(false); setComentario(''); setSeleccionados([]);
            setMensaje('Acción registrada. La notificación del estudiante quedó guardada.');
            const nuevo = await obtenerDetalle(id);
            if (vigente.current) { setDetalle(nuevo); setError(''); }
        } catch (e) {
            if (!vigente.current) return;
            // Una respuesta perdida puede haber confirmado la transacción: consultar antes de repetir.
            setConfirmando(false); setRequiereConsulta(true);
            setErrorEnvio(guardado ? 'La acción se guardó, pero no fue posible actualizar la vista. Actualiza la solicitud.' : (e instanceof Error ? e.message : 'No se pudo confirmar la acción.'));
        } finally {
            ocupado.current = false;
            if (vigente.current) setEnviando(false);
        }
    }
    if (cargando || !usuario) return <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true"><p>Verificando sesión...</p></main>;
    return <>
        <Navbar tipoUsuario="funcionario" nombreUsuario={usuario.name} />
        <main id="contenido" tabIndex={-1} className={styles.pagina}>
            <PageHeader ruta={[{ texto: 'Preinscripciones', href: '/funcionario/dashboard' }, { texto: `Solicitud ${id}` }]}
                titulo="Detalle de preinscripción" descripcion="Revisión de la solicitud y comunicación con el estudiante." />
            {error && <div role="alert"><p>{error}</p><Button onClick={() => setIntento(i => i + 1)}>Reintentar consulta</Button></div>}
            {!detalle && !error && <p role="status">Cargando solicitud...</p>}
            {detalle && <div className={styles.seccion}>
                <Card titulo={detalle.estudiante.nombre}>
                    <p>Código estudiantil: {detalle.estudiante.codigo}</p>
                    <p>Nivel: {detalle.estudiante.nivel} · Solicitud {detalle.id}</p>
                    <p>Estado: <strong>{ESTADOS[detalle.estadoSolicitud] ?? 'No disponible'}</strong></p>
                </Card>
                <Card titulo="Información del estudiante"><InformacionEstudiante nivel={detalle.estudiante.nivel} datos={detalle.informacion} variante="funcionario" /></Card>
                <Card titulo="Documentos analizados">
                    {detalle.documentos.length === 0 && <p>La solicitud aún no tiene documentos enviados.</p>}
                    <ul className={styles.documentos}>{detalle.documentos.map(doc => <li key={doc.id}>
                        <article className={styles.documento}>
                            <div className={styles.filaTitulo}><h3>{doc.nombre}</h3><StatusBadge estado={estadoDocumento(doc)} /></div>
                            <p>{doc.fileName} · Versión {doc.version}</p>
                            {doc.resultados.map((r, i) => <p key={i}>{r.mensaje}</p>)}
                            <Button variante="secundario" onClick={() => setAnalisis(analisisPersistido(doc))} aria-label={`Ver análisis automático: ${doc.nombre}`}>Ver análisis automático</Button>
                            {admiteDecision && doc.estado === 'POR_REVISAR' && <div className={styles.acciones}>
                                <Button variante="secundario" disabled={enviando} onClick={() => abrirResolucion(doc, 'VALIDO')} aria-label={`Marcar válido: ${doc.nombre}`}>Marcar válido</Button>
                                <Button variante="secundario" disabled={enviando} onClick={() => abrirResolucion(doc, 'NO_VALIDO')} aria-label={`Marcar no válido: ${doc.nombre}`}>Marcar no válido</Button>
                            </div>}
                        </article>
                    </li>)}</ul>
                </Card>
                <Card titulo="Acciones de revisión">
                    <form onSubmit={preparar} className={styles.formRevision}>
                        <label>Acción<select value={accion} onChange={e => { setAccion(e.target.value as AccionRevision); setErrorEnvio(''); }} disabled={enviando}>
                            <option value="comentario">Enviar comentario</option>
                            <option value="recarga" disabled={!admiteRecarga}>Solicitar corrección</option>
                            <option value="aceptada" disabled={!admiteAceptar}>Aceptar solicitud</option>
                            <option value="anulada" disabled={!admiteDecision}>Anular solicitud</option>
                        </select></label>
                        {!admiteDecision && <p>El estado actual solo permite agregar comentarios.</p>}
                        {admiteDecision && !admiteAceptar && <p>Solo se puede aceptar una solicitud válida.</p>}
                        {accion === 'recarga' && <fieldset><legend>Documentos que debe volver a subir</legend>
                            {corregibles.map(doc => <label key={doc.id} className={styles.opcionDocumento}><input type="checkbox" checked={seleccionados.includes(Number(doc.id))} disabled={enviando}
                                onChange={e => setSeleccionados(prev => e.target.checked ? [...prev, Number(doc.id)] : prev.filter(d => d !== Number(doc.id)))} />{doc.nombre}</label>)}
                        </fieldset>}
                        <label>Comentario{accion === 'comentario' ? ' (obligatorio)' : ' (opcional)'}<textarea value={comentario} maxLength={5000} required={accion === 'comentario'} rows={4} disabled={enviando} onChange={e => setComentario(e.target.value)} /></label>
                        <p>Al enviar un comentario, la notificación mostrará sus primeros 15 caracteres. El historial conserva el texto completo.</p>
                        <div className={styles.acciones}>
                            <Button type="submit" disabled={enviando || requiereConsulta || !!error || (accion !== 'comentario' && !admiteDecision) || (accion === 'aceptada' && !admiteAceptar)}>{ACCIONES[accion]}</Button>
                            <Button variante="secundario" disabled={enviando} onClick={() => setIntento(i => i + 1)}>Actualizar solicitud</Button>
                        </div>
                        {errorEnvio && <p role="alert">{errorEnvio}</p>}
                        {mensaje && <p role="status">{mensaje}</p>}
                    </form>
                </Card>
                <Card titulo="Historial de revisiones">
                    {!detalle.revisiones.length && <p>No hay revisiones registradas.</p>}
                    <ul className={styles.historial}>{detalle.revisiones.map(r => <li key={r.id}>
                        <strong>{RESULTADOS[r.resultado] ?? 'Revisión'}</strong>
                        <p>{r.funcionario} · {new Date(r.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                        {r.comentario && <p>{r.comentario}</p>}
                        {!!r.documentos?.length && <p>Documentos: {r.documentos.map(idDoc => detalle.documentos.find(d => Number(d.id) === idDoc)?.nombre ?? `Documento ${idDoc}`).join(', ')}</p>}
                    </li>)}</ul>
                </Card>
            </div>}
        </main>
        <Dialog abierto={confirmando} alCerrar={() => { if (!enviando) setConfirmando(false); }} titulo={`Confirmar: ${ACCIONES[accion]}`} descripcion="La acción quedará registrada en la solicitud y generará una notificación para el estudiante.">
            <p>{accion === 'recarga' ? corregibles.filter(d => seleccionados.includes(Number(d.id))).map(d => d.nombre).join(', ') : ACCIONES[accion]}</p>
            {comentario && <p className={styles.comentarioConfirmacion}>{comentario}</p>}
            <div className={styles.acciones}><Button cargando={enviando} textoCargando="Guardando..." onClick={enviar}>Confirmar acción</Button><Button variante="secundario" disabled={enviando} onClick={() => setConfirmando(false)}>Cancelar</Button></div>
        </Dialog>
        <Dialog abierto={!!resolucion} alCerrar={() => { if (!enviando) setResolucion(null); }}
            titulo={resolucion?.resultado === 'VALIDO' ? 'Marcar documento como válido' : 'Marcar documento como no válido'}
            descripcion="La resolución quedará en el historial, recalculará el estado de la solicitud y generará una notificación para el estudiante.">
            <p>{resolucion?.documento.nombre}</p>
            {resolucion?.resultado === 'NO_VALIDO' && <label>Motivo (obligatorio)<textarea value={motivo} maxLength={5000} rows={4} disabled={enviando} onChange={e => setMotivo(e.target.value)} /></label>}
            {errorResolucion && <p role="alert">{errorResolucion}</p>}
            <div className={styles.acciones}><Button cargando={enviando} textoCargando="Guardando..." onClick={confirmarResolucion}>Confirmar</Button><Button variante="secundario" disabled={enviando} onClick={() => setResolucion(null)}>Cancelar</Button></div>
        </Dialog>
        <DocumentAnalysis open={!!analisis} data={analisis} onClose={() => setAnalisis(null)} />
    </>;
}
