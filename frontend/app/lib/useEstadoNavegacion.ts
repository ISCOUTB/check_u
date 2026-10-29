'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  obtenerEstadoNavegacion,
  type RespuestaEstadoNavegacion,
} from './estadoNavegacion';

export interface EstadoNavegacionHook {
  cargando: boolean;
  /** Mensaje si falló la consulta; null si OK. No redirigir cuando hay error. */
  error: string | null;
  data: RespuestaEstadoNavegacion | null;
  reintentar: () => void;
}

/**
 * Carga GET /solicitudes/estado para el estudiante autenticado.
 * Si habilitado es false (p. ej. aún no hay sesión), no consulta.
 */
export function useEstadoNavegacion(
  habilitado: boolean = true,
): EstadoNavegacionHook {
  const [cargando, setCargando] = useState(habilitado);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RespuestaEstadoNavegacion | null>(null);
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!habilitado) {
      setCargando(false);
      return;
    }

    let vigente = true;
    const ac = new AbortController();

    setCargando(true);
    setError(null);

    void obtenerEstadoNavegacion(ac.signal)
      .then((res) => {
        if (!vigente) return;
        setData(res);
        setError(null);
        setCargando(false);
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo obtener el estado de la solicitud.',
        );
        setCargando(false);
      });

    return () => {
      vigente = false;
      ac.abort();
    };
  }, [habilitado, intento]);

  return { cargando, error, data, reintentar };
}
