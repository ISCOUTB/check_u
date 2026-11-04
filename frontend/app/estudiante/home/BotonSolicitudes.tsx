'use client';

import { useEffect, useState } from 'react';
import Button from '@/app/components/ui/Button';
import { obtenerSolicitudes } from '../solicitudes/api';
import styles from './home.module.css';

/**
 * Botón "Solicitudes" con badge del total de preinscripciones del estudiante.
 * Usa el listado real (incluye canceladas/anuladas). Un fallo no bloquea el home.
 */
export default function BotonSolicitudes() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let vigente = true;

    obtenerSolicitudes(ac.signal)
      .then((lista) => {
        if (vigente) setTotal(lista.length);
      })
      .catch(() => {
        // Silencioso: el badge simplemente no se muestra si falla
        if (vigente) setTotal(null);
      });

    return () => {
      vigente = false;
      ac.abort();
    };
  }, []);

  return (
    <Button
      href="/estudiante/solicitudes"
      variante="secundario"
      className={styles.botonSolicitudes}
      aria-label={
        total === null
          ? 'Ver mis solicitudes'
          : `Ver mis solicitudes (${total} en total)`
      }
    >
      Solicitudes
      {total !== null && (
        <span className={styles.badgeSolicitudes} aria-hidden="true">
          {total}
        </span>
      )}
    </Button>
  );
}
