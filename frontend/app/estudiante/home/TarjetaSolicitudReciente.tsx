'use client';

import { useState } from 'react';
import TablaPazYSalvo from '@/app/components/biblioteca/TablaPazYSalvo';
import { mensajesFueraDeTabla } from '@/app/components/biblioteca/tipos';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import StatusBadge from '@/app/components/ui/StatusBadge';
import type { SolicitudListado } from '../solicitudes/listado';
import { presentarEstado } from '../solicitudes/listado';
import type { SolicitudDetalle } from './api';
import { useConsultaPazYSalvo } from '../preinscripcion/useConsultaPazYSalvo';
import {
  construirRequisitos,
  formatearFechaCorta,
  periodoDeSolicitud,
  progresoRequisitos,
  type EstadoRequisito,
  type RequisitoResumen,
} from './resumen';
import type { NivelAcademico } from '../documentos-requeridos';
import styles from './home.module.css';

const ETIQUETA_PARA_ESTUDIANTE: Partial<Record<EstadoRequisito, string>> = {
  no_valido: 'Corrección requerida',
};

interface TarjetaSolicitudRecienteProps {
  resumenListado: {
    total: number;
    reciente: SolicitudListado | null;
    error: string | null;
  } | null;
  solicitud: SolicitudDetalle | null | undefined;
  errorSolicitud: string | null;
  nivelEfectivo: NivelAcademico;
  hrefContinuar: string;
  onReintentar: () => void;
}

export default function TarjetaSolicitudReciente({
  resumenListado,
  solicitud,
  errorSolicitud,
  nivelEfectivo,
  hrefContinuar,
  onReintentar,
}: TarjetaSolicitudRecienteProps) {
  // Tarea 50: «Consultar de nuevo» el Paz y Salvo en Biblioteca (cuenta como un reenvío).
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const consultarBiblioteca = useConsultaPazYSalvo();

  if (resumenListado === null) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p className={styles.textoSecundario}>Cargando solicitud...</p>
      </Card>
    );
  }

  if (resumenListado.error) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p role="alert" className={styles.textoError}>
          {resumenListado.error}
        </p>
        <Button variante="secundario" onClick={onReintentar}>
          Reintentar
        </Button>
      </Card>
    );
  }

  if (resumenListado.reciente === null) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p className={styles.textoSecundario} style={{ marginBottom: '15px' }}>
          No tienes solicitudes registradas todavía.
        </p>
        <Button href="/estudiante/bienvenida">Nueva preinscripción</Button>
      </Card>
    );
  }

  if (solicitud === undefined && !errorSolicitud) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p className={styles.textoSecundario}>Cargando solicitud...</p>
      </Card>
    );
  }

  if (errorSolicitud || solicitud === null) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p role="alert" className={styles.textoError}>
          {errorSolicitud ??
            'No fue posible cargar la solicitud. Intenta recargar la página.'}
        </p>
        <Button variante="secundario" onClick={onReintentar}>
          Reintentar
        </Button>
      </Card>
    );
  }
  // Narrowing para TypeScript: aquí solicitud ya es SolicitudDetalle.
  if (!solicitud) {
    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p className={styles.textoSecundario}>Cargando solicitud...</p>
      </Card>
    );
  }

  const segundoPrograma = solicitud.informacion.tieneSegundoPrograma === true;
  const requisitos = construirRequisitos(
    nivelEfectivo,
    segundoPrograma,
    solicitud.documentos ?? [],
  );
  const progreso = progresoRequisitos(requisitos);
  const periodo = periodoDeSolicitud(solicitud);
  const estadoListado = presentarEstado(resumenListado.reciente.estado);

  const consultarDeNuevo = async () => {
    if (!solicitud) return;
    setConsultando(true);
    setErrorConsulta(null);
    try {
      if (await consultarBiblioteca(solicitud.id)) onReintentar();
    } catch (error) {
      setErrorConsulta(
        error instanceof Error ? error.message : 'No fue posible consultar Biblioteca.',
      );
    } finally {
      setConsultando(false);
    }
  };

  const filaRequisito = (requisito: RequisitoResumen) => {
    const puedeSubir =
      !requisito.consulta &&
      (requisito.estado === 'falta_cargar' || requisito.resubmissionAllowed);
    const etiquetaAccion =
      requisito.estado === 'falta_cargar'
        ? 'Subir documento'
        : 'Subir nueva versión';

    return (
      <li
        key={requisito.clave}
        className={
          requisito.biblioteca
            ? `${styles.documento} ${styles.documentoConTabla}`
            : styles.documento
        }
      >
        <div className={styles.documentoInfo}>
          <div className={styles.documentoNombre}>
            <span>{requisito.nombre}</span>
            <StatusBadge
              estado={requisito.estado}
              etiqueta={ETIQUETA_PARA_ESTUDIANTE[requisito.estado]}
            />
          </div>
          {requisito.biblioteca && <TablaPazYSalvo resultado={requisito.biblioteca} />}
          {mensajesFueraDeTabla(requisito.observaciones, requisito.biblioteca).map((observacion, indice) => (
            <p
              key={`${requisito.clave}-observacion-${indice}`}
              className={
                requisito.estado === 'no_valido'
                  ? styles.motivo
                  : styles.documentoDetalle
              }
            >
              {observacion}
            </p>
          ))}
        </div>
        {requisito.consulta && requisito.resubmissionAllowed && (
          <Button
            variante="secundario"
            className={styles.documentoAccion}
            disabled={consultando}
            onClick={consultarDeNuevo}
            aria-label={`Consultar de nuevo: ${requisito.nombre}`}
          >
            Consultar de nuevo
          </Button>
        )}
        {requisito.consulta && errorConsulta && (
          <p role="alert" className={styles.textoError}>
            {errorConsulta}
          </p>
        )}
        {puedeSubir && (
          <Button
            href={hrefContinuar}
            variante="secundario"
            className={styles.documentoAccion}
            aria-label={`${etiquetaAccion}: ${requisito.nombre}`}
          >
            {etiquetaAccion}
          </Button>
        )}
      </li>
    );
  };

  return (
    <Card
      titulo="Mi solicitud de grado"
      id="mi-solicitud"
      acciones={
        <Button href="/estudiante/solicitudes" variante="sutil">
          Ver todas mis solicitudes
        </Button>
      }
    >
      {!resumenListado.reciente.activa && (
        <p className={styles.textoSecundario}>
          Estado:{' '}
          <StatusBadge
            estado={estadoListado.tono}
            etiqueta={estadoListado.etiqueta}
          />
        </p>
      )}

      {solicitud.estadoSolicitud === 'CERRADA' && solicitud.motivoAnulacion && (
        <p className={styles.motivoAnulacion}>
          <strong>Motivo de anulación:</strong> {solicitud.motivoAnulacion}
        </p>
      )}

      <dl className={styles.metaSolicitud}>
        <div className={styles.metaItem}>
          <dt>Tipo de solicitud</dt>
          <dd>
            {nivelEfectivo}
            {segundoPrograma && ' · doble programa'}
          </dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Periodo</dt>
          <dd>{periodo?.nombre ?? 'Sin periodo asignado'}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Abre</dt>
          <dd>{formatearFechaCorta(periodo?.fechaInicio)}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Cierra</dt>
          <dd>{formatearFechaCorta(periodo?.fechaFin)}</dd>
        </div>
      </dl>

      <p className={styles.progresoTexto}>
        {progreso.validos} de {progreso.total} requisitos válidos
      </p>

      <div
        className={styles.progreso}
        role="progressbar"
        aria-label="Progreso de requisitos válidos"
        aria-valuemin={0}
        aria-valuemax={progreso.total}
        aria-valuenow={progreso.validos}
        aria-valuetext={`${progreso.validos} de ${progreso.total} requisitos válidos`}
      >
        <div
          className={styles.progresoRelleno}
          style={{
            transform: `scaleX(${
              progreso.total ? progreso.validos / progreso.total : 0
            })`,
          }}
        />
      </div>

      <ul className={styles.documentos}>{requisitos.map(filaRequisito)}</ul>
    </Card>
  );
}
