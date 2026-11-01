'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/app/components/ui/Button';
import Dialog from '@/app/components/ui/Dialog';
import { cancelarPreinscripcion } from './api';
import type { SolicitudDetalle } from './types';
import styles from './preinscripcion.module.css';

export default function CancelarPreinscripcion({
    solicitud,
    deshabilitado,
    onCancelada,
    onReconsultar,
}: {
    solicitud: SolicitudDetalle;
    deshabilitado: boolean;
    onCancelada: (fecha: string | null) => void;
    onReconsultar: () => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const bloqueo = useRef(false);
    const vigente = useRef(true);
    useEffect(() => {
        vigente.current = true;
        return () => {
            vigente.current = false;
        };
    }, []);
    // El componente permanece montado durante la operación; el padre confirma el cambio de estado.
    const plazo = solicitud.cancelacion;
    // Tarea 42: «en proceso» es cualquier solicitud enviada que la funcionaria aún no decide.
    const permitida = solicitud.cancelacion?.permitida ?? ['EN_PROCESO', 'POR_REVISAR', 'NO_VALIDA', 'INCONSISTENTE', 'VALIDA'].includes(solicitud.estadoSolicitud);
    async function confirmar() {
        if (bloqueo.current || !permitida || deshabilitado) return;
        bloqueo.current = true;
        setEnviando(true);
        setError('');
        try {
            const r = await cancelarPreinscripcion(solicitud.id);
            if (vigente.current) {
                setAbierto(false);
                onCancelada(r.canceladaEn);
            }
        } catch (e) {
            if (vigente.current)
                setError(
                    e instanceof Error
                        ? e.message
                        : 'No fue posible confirmar la cancelación.',
                );
        } finally {
            bloqueo.current = false;
            if (vigente.current) setEnviando(false);
        }
    }
    return (
        <section
            className={styles.cancelacion}
            aria-label="Estado de la preinscripción"
        >
            {solicitud.estadoSolicitud === 'CANCELADA' ? (
                <div role="status">
                    <h2>Preinscripción cancelada</h2>
                    <p>
                        Esta preinscripción está CANCELADA. No está activa y no
                        puede reactivarse. Su información y los resultados
                        documentales se conservan para consulta.
                    </p>
                </div>
            ) : (
                <p>
                    Estado de la preinscripción:{' '}
                    <strong>
                        {(
                            {
                                BORRADOR: 'Borrador',
                                EN_PROCESO: 'En proceso',
                                POR_REVISAR: 'Por revisar',
                                VALIDA: 'Válida',
                                NO_VALIDA: 'Inválida',
                                INCONSISTENTE: 'Inconsistente',
                                ACEPTADA: 'Aceptada',
                                CERRADA: 'Anulada',
                            } as Record<string, string>
                        )[solicitud.estadoSolicitud] ?? 'No disponible'}
                    </strong>
                </p>
            )}
            {permitida && (
                <Button
                    variante="secundario"
                    disabled={deshabilitado || enviando}
                    onClick={() => {
                        setError('');
                        setAbierto(true);
                    }}
                >
                    Cancelar preinscripción
                </Button>
            )}
            {!abierto && error && <p role="alert">{error}</p>}
            <Dialog
                abierto={abierto}
                alCerrar={() => {
                    if (!bloqueo.current) setAbierto(false);
                }}
                titulo="Cancelar preinscripción"
            >
                <p>
                    ¿Estás seguro(a) de cancelar tu preinscripción? Esta acción
                    no se puede deshacer.
                </p>
                <p>
                    Si deseas continuar con otra preinscripción en un periodo
                    diferente, ten en cuenta que debes cumplir con los
                    requisitos dentro del plazo establecido para dicho periodo.
                    Si no cumples con estos requisitos, tu preinscripción será
                    anulada y deberás inscribirte en el siguiente periodo hábil.
                </p>
                {plazo?.nombrePeriodo &&
                typeof plazo.fechaCorte === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(plazo.fechaCorte) &&
                plazo.diasRestantes !== null &&
                Number.isInteger(plazo.diasRestantes) &&
                plazo.diasRestantes >= 0 ? (
                    <>
                        <p>
                            En el periodo actual{' '}
                            <strong>{plazo.nombrePeriodo}</strong> te quedan{' '}
                            <strong>
                                {plazo.diasRestantes}{' '}
                                {plazo.diasRestantes === 1 ? 'día' : 'días'}
                            </strong>{' '}
                            para presentar los requisitos.
                        </p>
                        <p>
                            Fecha límite:{' '}
                            {plazo.fechaCorte.split('-').reverse().join('/')}{' '}
                            (fecha de cierre menos 7 días para revisión humana).
                            Hora de Colombia.
                        </p>
                        {plazo.fechaActual > plazo.fechaCorte && (
                            <p>
                                El plazo para presentar los requisitos ya
                                venció.
                            </p>
                        )}
                    </>
                ) : (
                    <p>
                        No se pudo determinar el plazo del periodo asignado. No
                        se muestran fechas ni días estimados.
                    </p>
                )}
                <div className={styles.accionesCancelacion}>
                    <Button
                        variante="secundario"
                        disabled={enviando}
                        onClick={() => setAbierto(false)}
                    >
                        Conservar preinscripción
                    </Button>
                    <Button
                        cargando={enviando}
                        textoCargando="Cancelando..."
                        onClick={confirmar}
                    >
                        Confirmar cancelación
                    </Button>
                </div>
                {error && (
                    <Button
                        variante="secundario"
                        onClick={() => {
                            setAbierto(false);
                            onReconsultar();
                        }}
                    >
                        Actualizar preinscripción
                    </Button>
                )}
                {error && (
                    <p role="alert">
                        {error} Puedes volver a consultar la preinscripción
                        antes de reintentar; repetir una cancelación confirmada
                        no la duplica.
                    </p>
                )}
            </Dialog>
        </section>
    );
}
