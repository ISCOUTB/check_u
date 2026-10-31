'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import styles from './HistorialPreinscripciones.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const ESTADOS: Record<string, string> = {
    BORRADOR: 'Borrador',
    EN_PROCESO: 'En proceso',
    VALIDA: 'Válida',
    NO_VALIDA: 'Inválida',
    INCONSISTENTE: 'Inconsistente',
    POR_REVISAR: 'Por revisar',
    CANCELADA: 'CANCELADA',
    CERRADA: 'Anulada',
};
interface Registro {
    id: string;
    nivel: 'PREGRADO' | 'POSGRADO';
    estado: string;
    activa: boolean;
    fechaSolicitud: string | null;
    periodo: { nombre: string; fechaInicio: string; fechaFin: string } | null;
}
const fecha = (valor: string) => valor.split('-').reverse().join('/');

/** Acceso histórico mínimo para #107; contrato reutilizable por el listado de #106. */
export default function HistorialPreinscripciones({
    actualizar = '',
}: {
    actualizar?: string;
}) {
    const [registros, setRegistros] = useState<Registro[] | null>(null);
    const [error, setError] = useState('');
    const [intento, setIntento] = useState(0);
    useEffect(() => {
        const controlador = new AbortController();
        let vigente = true;
        let agotado = false;
        const timer = setTimeout(() => {
            agotado = true;
            controlador.abort();
        }, 15000);
        fetch(`${API}/estudiante/solicitudes`, {
            credentials: 'include',
            cache: 'no-store',
            signal: controlador.signal,
        })
            .then(async (r) => {
                if (!r.ok)
                    throw new Error('No fue posible consultar el historial.');
                return r.json();
            })
            .then((data) => {
                if (
                    !Array.isArray(data?.solicitudes) ||
                    data.solicitudes.some(
                        (r: Registro) =>
                            !r ||
                            typeof r.id !== 'string' ||
                            !Object.hasOwn(ESTADOS, r.estado) ||
                            !['PREGRADO', 'POSGRADO'].includes(r.nivel) ||
                            typeof r.activa !== 'boolean' ||
                            !(
                                r.fechaSolicitud === null ||
                                (typeof r.fechaSolicitud === 'string' &&
                                    Number.isFinite(
                                        Date.parse(r.fechaSolicitud),
                                    ))
                            ) ||
                            !(
                                r.periodo === null ||
                                (typeof r.periodo === 'object' &&
                                    typeof r.periodo.nombre === 'string' &&
                                    typeof r.periodo.fechaInicio === 'string' &&
                                    /^\d{4}-\d{2}-\d{2}$/.test(
                                        r.periodo.fechaInicio,
                                    ) &&
                                    typeof r.periodo.fechaFin === 'string' &&
                                    /^\d{4}-\d{2}-\d{2}$/.test(
                                        r.periodo.fechaFin,
                                    ))
                            ),
                    )
                )
                    throw new Error('El historial recibido no es válido.');
                if (vigente) {
                    setRegistros(data.solicitudes);
                    setError('');
                }
            })
            .catch((e) => {
                if (vigente)
                    setError(
                        agotado
                            ? 'La consulta del historial tardó demasiado.'
                            : e instanceof Error
                              ? e.message
                              : 'No fue posible consultar el historial.',
                    );
            })
            .finally(() => clearTimeout(timer));
        return () => {
            vigente = false;
            clearTimeout(timer);
            controlador.abort();
        };
    }, [intento, actualizar]);
    if (!error && registros?.length === 0) return null;
    return (
        <Card titulo="Historial de preinscripciones" className={styles.panel}>
            {error ? (
                <div role="alert">
                    <p>{error}</p>
                    <Button
                        variante="secundario"
                        onClick={() => {
                            setError('');
                            setRegistros(null);
                            setIntento((n) => n + 1);
                        }}
                    >
                        Reintentar historial
                    </Button>
                </div>
            ) : registros === null ? (
                <p role="status">Cargando historial...</p>
            ) : !registros.length ? (
                <p>No hay preinscripciones registradas.</p>
            ) : (
                <ul className={styles.lista}>
                    {registros.map((r) => (
                        <li
                            key={r.id}
                            className={styles.registro}
                            data-estado={r.estado}
                        >
                            <h3>
                                Solicitud {r.id} ·{' '}
                                {r.nivel === 'PREGRADO'
                                    ? 'Pregrado'
                                    : 'Posgrado'}
                            </h3>
                            <p>
                                <strong>{ESTADOS[r.estado]}</strong> ·{' '}
                                {r.activa
                                    ? 'Activa'
                                    : 'Histórica, sin gestión pendiente'}
                            </p>
                            <p>
                                Fecha de envío:{' '}
                                {r.fechaSolicitud
                                    ? new Date(r.fechaSolicitud).toLocaleString(
                                          'es-CO',
                                          { timeZone: 'America/Bogota' },
                                      )
                                    : 'Sin envío registrado'}
                            </p>
                            <p>
                                {r.periodo
                                    ? `${r.periodo.nombre}: ${fecha(r.periodo.fechaInicio)} – ${fecha(r.periodo.fechaFin)}`
                                    : 'Sin periodo asociado'}
                            </p>
                            <Link
                                className={styles.enlace}
                                href={`/estudiante/preinscripcion?solicitud=${encodeURIComponent(r.id)}`}
                                aria-label={`Ver detalle de solicitud ${r.id}`}
                            >
                                Ver detalle
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
