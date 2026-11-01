import type { SolicitudDetalle } from '@/app/estudiante/preinscripcion/types';
import type { SolicitudResumen, EstadoSolicitud } from './dashboard/datos';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
export type AccionRevision = 'comentario' | 'recarga' | 'aceptada' | 'anulada';
export interface Revision {
    id: string; resultado: string; comentario: string | null;
    documentos: number[] | null; fecha: string; funcionario: string;
}
export type DetalleFuncionaria = SolicitudDetalle & { revisiones: Revision[] };
export type ResumenFuncionaria = SolicitudResumen & { etiqueta: string };

/** Las consultas tienen un límite; las mutaciones no se reintentan automáticamente. */
async function consultar(ruta: string, opciones: RequestInit = {}, signal?: AbortSignal) {
    const controlador = new AbortController();
    const cancelar = () => controlador.abort();
    const timer = setTimeout(cancelar, 15_000);
    signal?.addEventListener('abort', cancelar, { once: true });
    if (signal?.aborted) cancelar();
    try {
        const r = await fetch(`${API}${ruta}`, { ...opciones, credentials: 'include', cache: 'no-store', signal: controlador.signal });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof data?.message === 'string' ? data.message : `No fue posible completar la operación (${r.status}).`);
        return data;
    } catch (error) {
        if (controlador.signal.aborted) throw new Error('La operación tardó demasiado o fue cancelada. Consulta el estado antes de repetirla.');
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancelar);
    }
}
const ESTADOS: Record<string, [EstadoSolicitud, string]> = {
    BORRADOR: ['por_revisar', 'Borrador'], EN_PROCESO: ['por_revisar', 'En proceso'],
    POR_REVISAR: ['por_revisar', 'Por revisar'], VALIDA: ['valido', 'Válida'],
    NO_VALIDA: ['no_valido', 'No válida'], INCONSISTENTE: ['inconsistente', 'Inconsistente'],
    ACEPTADA: ['valido', 'Aceptada'], CERRADA: ['no_valido', 'Anulada'],
};
export async function obtenerSolicitudes(signal?: AbortSignal): Promise<ResumenFuncionaria[]> {
    const data = await consultar('/funcionario/solicitudes', {}, signal);
    if (!Array.isArray(data)) throw new Error('Listado de solicitudes inválido.');
    return data.map(s => {
        if (!s || typeof s.id !== 'string' || !ESTADOS[s.estado] || !['PREGRADO', 'POSGRADO'].includes(s.nivel)) throw new Error('Solicitud inválida.');
        const [estado, etiqueta] = ESTADOS[s.estado];
        return { numero: s.id, fechaRegistro: s.fechaRegistro, estudiante: s.estudiante, nivel: s.nivel,
            estado, etiqueta, periodId: s.periodId,
            fecha: new Date(s.fechaRegistro).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) };
    });
}
export async function obtenerDetalle(id: string, signal?: AbortSignal): Promise<DetalleFuncionaria> {
    const data = await consultar(`/funcionario/solicitudes/${encodeURIComponent(id)}`, {}, signal);
    if (!data?.estudiante || !data.informacion || !Array.isArray(data.documentos) || !Array.isArray(data.revisiones)) throw new Error('Detalle de solicitud inválido.');
    return data;
}
/** Tarea 42a: la funcionaria resuelve un documento «Por revisar». */
export async function resolverDocumento(id: string, resultado: 'VALIDO' | 'NO_VALIDO', comentario: string) {
    return consultar(`/funcionario/documentos/${encodeURIComponent(id)}/resolucion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, ...(comentario ? { comentario } : {}) }),
    });
}
export async function registrarRevision(id: string, accion: AccionRevision, comentario: string, documentos: number[]) {
    return consultar(`/funcionario/solicitudes/${encodeURIComponent(id)}/revisiones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, comentario, ...(accion === 'recarga' ? { documentos } : {}) }),
    });
}
