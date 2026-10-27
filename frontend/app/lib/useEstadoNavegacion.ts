'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ErrorEstadoNavegacion,
  obtenerEstadoNavegacion,
  type RespuestaEstadoNavegacion,
} from './estadoNavegacion';

export interface EstadoNavegacionHook {
  cargando: boolean;
  error: string | null;
  data: RespuestaEstadoNavegacion | null;
  reintentar: () => void;
}

/**
 * Carga el estado de navegación cuando habilitado=true (p. ej. ya hay sesión estudiante).
 * En error NO inventa SIN_SOLICITUD.
 */
export function useEstadoNavegacion(
  habilitado: boolean = true,
): EstadoNavegacionHook {
  const [cargando, setCargando] = useState(habilitado);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RespuestaEstadoNavegacion | null>(null);
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => {
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!habilitado) {
      return;
    }

    let vigente = true;

    void (async () => {
      try {
        const estado = await obtenerEstadoNavegacion();
        if (vigente) {
          setData(estado);
        }
      } catch (e) {
        if (vigente) {
          setData(null);
          setError(
            e instanceof ErrorEstadoNavegacion
              ? e.message
              : 'No se pudo obtener el estado de la solicitud.',
          );
        }
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [habilitado, intento]);

  return { cargando, error, data, reintentar };
}
