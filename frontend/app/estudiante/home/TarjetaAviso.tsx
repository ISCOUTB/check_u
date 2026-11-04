'use client';

import Card from '@/app/components/ui/Card';
import type { SolicitudDetalle } from './api';
import styles from './home.module.css';

interface TarjetaAvisoProps {
  solicitud: SolicitudDetalle | null | undefined;
  errorSolicitud: string | null;
}

export default function TarjetaAviso({
  solicitud,
  errorSolicitud,
}: TarjetaAvisoProps) {
  const politica = solicitud?.politicaReenvios ?? null;

  return (
    <Card titulo="Antes de enviar" className={styles.aviso}>
      <p className={styles.avisoTexto}>
        CheckU prevalida tus documentos; no reemplaza la decisión oficial de la
        Universidad.
      </p>

      {politica ? (
        politica.limite > 0 ? (
          <p className={styles.reenvios}>
            <strong>Reenvíos de corrección hoy:</strong>{' '}
            {politica.limite - politica.usados} de {politica.limite} disponibles
          </p>
        ) : (
          <p className={styles.reenvios}>
            La solicitud no admite correcciones en este momento.
          </p>
        )
      ) : solicitud === undefined && !errorSolicitud ? (
        <p className={styles.textoSecundario}>
          Cargando política de reenvíos...
        </p>
      ) : (
        <p className={styles.textoSecundario}>
          No fue posible consultar la política de reenvíos.
        </p>
      )}
    </Card>
  );
}
