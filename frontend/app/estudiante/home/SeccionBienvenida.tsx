'use client';

import Button from '@/app/components/ui/Button';
import Icono from '@/app/components/ui/Icono';
import type { SolicitudListado } from '../solicitudes/listado';
import { enCurso, presentarEstado } from '../solicitudes/listado';
import styles from './home.module.css';

interface SeccionBienvenidaProps {
  nombreNivel: string;
  reciente: SolicitudListado | null | undefined;
  hrefContinuar: string;
  puedeIniciarNueva?: boolean;
}

export default function SeccionBienvenida({
  nombreNivel,
  reciente,
  hrefContinuar,
  puedeIniciarNueva,
}: SeccionBienvenidaProps) {
  const admiteNueva =
    puedeIniciarNueva !== undefined ? puedeIniciarNueva : !reciente?.activa;

  const aceptada = reciente?.estado === 'ACEPTADA';
  const recienteEnCurso = reciente ? enCurso(reciente) : false;

  const titulo = reciente
    ? aceptada
      ? 'Tu solicitud de grado fue aceptada'
      : recienteEnCurso
        ? 'Tu solicitud de grado está en curso'
        : `Tu solicitud más reciente está ${presentarEstado(reciente.estado).etiqueta.toLowerCase()}`
    : 'Aún no tienes solicitudes de grado';

  const texto = reciente
    ? aceptada
      ? `Tu solicitud de ${nombreNivel} fue aceptada. Puedes consultar su detalle y el historial completo.`
      : admiteNueva
        ? `Revisa el estado de tu solicitud de ${nombreNivel}. Puedes consultar el historial completo o iniciar una nueva preinscripción.`
        : `Revisa el estado de tu solicitud de ${nombreNivel}. Puedes consultar el historial completo.`
    : 'Cuando inicies una preinscripción aparecerá aquí con su estado y su periodo asignado.';

  const revisarHref = reciente
    ? `/estudiante/preinscripcion?solicitud=${encodeURIComponent(reciente.id)}`
    : hrefContinuar;

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

      {(recienteEnCurso || aceptada || reciente?.estado === 'CANCELADA') && (
        <div className={styles.accionesBienvenida}>
          {recienteEnCurso ? (
            <Button href={hrefContinuar} className={styles.bienvenidaAccion}>
              Continuar mi preinscripción
            </Button>
          ) : (
            <Button href={revisarHref} className={styles.bienvenidaAccion}>
              Revisar
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
