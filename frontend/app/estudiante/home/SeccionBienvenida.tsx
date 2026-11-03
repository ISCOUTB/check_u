'use client';

import Button from '@/app/components/ui/Button';
import Icono from '@/app/components/ui/Icono';
import type { SolicitudListado } from '../solicitudes/listado';
import { presentarEstado } from '../solicitudes/listado';
import BotonSolicitudes from './BotonSolicitudes';
import styles from './home.module.css';

interface SeccionBienvenidaProps {
  nombreNivel: string;
  reciente: SolicitudListado | null | undefined;
  hrefContinuar: string;
}

export default function SeccionBienvenida({
  nombreNivel,
  reciente,
  hrefContinuar,
}: SeccionBienvenidaProps) {
  const titulo = reciente
    ? reciente.activa
      ? 'Tu solicitud de grado está en curso'
      : `Tu solicitud más reciente está ${presentarEstado(reciente.estado).etiqueta.toLowerCase()}`
    : 'Aún no tienes solicitudes de grado';

  const texto = reciente
    ? `Revisa el estado de tu solicitud de ${nombreNivel}. Puedes consultar el historial completo o iniciar una nueva preinscripción.`
    : 'Cuando inicies una preinscripción aparecerá aquí con su estado y su periodo asignado.';

  return (
    <section className={styles.bienvenida} aria-labelledby="titulo-bienvenida">
      <div className={styles.bienvenidaPrincipal}>
        <span className={styles.bienvenidaIcono}>
          <Icono nombre="escudo" tamano={26} />
        </span>
        <div>
          <h2 id="titulo-bienvenida" className={styles.bienvenidaTitulo}>
            {titulo}
          </h2>
          <p className={styles.bienvenidaTexto}>{texto}</p>
        </div>
      </div>

      <div className={styles.accionesBienvenida}>
        {reciente?.activa && (
          <Button href={hrefContinuar} className={styles.bienvenidaAccion}>
            Continuar mi preinscripción
          </Button>
        )}
        <BotonSolicitudes />
        <Button href="/estudiante/bienvenida" variante="secundario">
          Nueva preinscripción
        </Button>
      </div>
    </section>
  );
}
