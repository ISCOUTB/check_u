'use client';

import { useCallback, useRef } from 'react';
import { claveConsultaPazYSalvo, reconsultarPazYSalvo } from './api';

/** El backend respondió con un 4xx: la consulta no se hizo y repetirla con la misma clave no sirve. */
function esRespuestaDefinitiva(error: unknown): boolean {
  const estado = (error as { estado?: unknown } | null)?.estado;
  return typeof estado === 'number' && estado >= 400 && estado < 500;
}

/**
 * Tarea 50: «Consultar de nuevo» el Paz y Salvo en Biblioteca.
 *
 * La clave se conserva hasta un éxito o una respuesta definitiva (4xx). Si la red falla o se agota el
 * tiempo después de que el backend guardó la consulta, el reintento manda la misma clave y no gasta
 * otro de los 3 reenvíos del día. El ref evita una segunda petición mientras la primera sigue en curso.
 * Devuelve false si ya había una consulta en curso.
 */
export function useConsultaPazYSalvo() {
  const enCurso = useRef(false);
  const clave = useRef<string | null>(null);
  return useCallback(async (idSolicitud: string): Promise<boolean> => {
    if (enCurso.current) return false;
    enCurso.current = true;
    clave.current ??= claveConsultaPazYSalvo();
    try {
      await reconsultarPazYSalvo(idSolicitud, clave.current);
      clave.current = null;
      return true;
    } catch (error) {
      if (esRespuestaDefinitiva(error)) clave.current = null;
      throw error;
    } finally {
      enCurso.current = false;
    }
  }, []);
}
