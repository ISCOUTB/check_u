'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Navbar from '@/app/components/navbar/Navbar';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Icono from '@/app/components/ui/Icono';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';

import { useEstadoNavegacion } from '@/app/lib/useEstadoNavegacion';
import { useSesion } from '@/app/lib/useSesion';

import styles from './home.module.css';
import NotificacionesPanel from './NotificacionesPanel';

import {
  ErrorConsultaSolicitud,
  obtenerSolicitudDetalle,
  type SolicitudDetalle,
} from './api';
import type { NivelAcademico } from '../documentos-requeridos';
import {
  construirRequisitos,
  formatearFechaCorta,
  periodoDeSolicitud,
  progresoRequisitos,
  type EstadoRequisito,
  type RequisitoResumen,
} from './resumen';

/** El estudiante ve "Corrección requerida" donde el sistema dice "No válido". */
const ETIQUETA_PARA_ESTUDIANTE: Partial<Record<EstadoRequisito, string>> = {
  no_valido: 'Corrección requerida',
};

function esCancelacion(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export default function Home() {
  const { usuario, cargando: cargandoSesion } = useSesion('estudiante');

  const router = useRouter();
  const pathname = usePathname();

  const {
    cargando: cargandoEstado,
    error: errorEstado,
    data: estadoNav,
    reintentar: reintentarEstado,
  } = useEstadoNavegacion(Boolean(usuario));

  const [detalle, setDetalle] = useState<{
    clave: string;
    solicitud: SolicitudDetalle | null;
    error: string | null;
  } | null>(null);
  const [intento, setIntento] = useState(0);

  // Redirigir según el estado real de la solicitud.
  useEffect(() => {
    if (!estadoNav?.destino) return;

    if (estadoNav.destino !== pathname) {
      router.replace(estadoNav.destino);
    }
  }, [estadoNav, pathname, router]);

  const claveDetalle =
    usuario && estadoNav?.estado === 'ENVIADA'
      ? `${estadoNav.estado}:${intento}`
      : null;

  // Cargar el detalle real cuando la solicitud ya fue enviada.
  useEffect(() => {
    if (!claveDetalle) return;

    const controlador = new AbortController();
    let vigente = true;

    obtenerSolicitudDetalle(controlador.signal)
      .then((solicitud) => {
        if (vigente) setDetalle({ clave: claveDetalle, solicitud, error: null });
      })
      .catch((error: unknown) => {
        if (!vigente || esCancelacion(error)) return;
        if (error instanceof ErrorConsultaSolicitud && error.status === 404) {
          setDetalle({ clave: claveDetalle, solicitud: null, error: null });
          return;
        }
        setDetalle({
          clave: claveDetalle,
          solicitud: null,
          error:
            'No fue posible cargar el resumen de tu solicitud. Intenta recargar la página.',
        });
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [claveDetalle]);

  const detalleVigente = detalle?.clave === claveDetalle ? detalle : null;
  const solicitud = detalleVigente?.solicitud;
  const errorSolicitud = detalleVigente?.error ?? null;

  const nivelEfectivo: NivelAcademico =
    solicitud?.estudiante.nivel ??
    estadoNav?.nivel ??
    usuario?.nivel ??
    'PREGRADO';

  const segundoPrograma = solicitud?.informacion.tieneSegundoPrograma === true;

  const requisitos = useMemo(
    () =>
      construirRequisitos(
        nivelEfectivo,
        segundoPrograma,
        solicitud?.documentos ?? [],
      ),
    [nivelEfectivo, segundoPrograma, solicitud?.documentos],
  );

  const progreso = useMemo(() => progresoRequisitos(requisitos), [requisitos]);
  const periodo = periodoDeSolicitud(solicitud);
  const politica = solicitud?.politicaReenvios ?? null;

  const cargando =
    cargandoSesion || (Boolean(usuario) && cargandoEstado && !errorEstado);

  if (cargando || !usuario) {
    return (
      <main
        id="contenido"
        tabIndex={-1}
        className={styles.cargando}
        aria-busy="true"
      >
        <span className={styles.spinner} aria-hidden="true" />
        <p>Verificando sesión...</p>
      </main>
    );
  }

  if (errorEstado) {
    return (
      <main id="contenido" tabIndex={-1} className={styles.pagina}>
        <p role="alert">{errorEstado}</p>
        <Button variante="secundario" onClick={() => reintentarEstado()}>
          Reintentar
        </Button>
      </main>
    );
  }

  if (estadoNav && estadoNav.destino !== pathname) {
    return (
      <main
        id="contenido"
        tabIndex={-1}
        className={styles.cargando}
        aria-busy="true"
      >
        <span className={styles.spinner} aria-hidden="true" />
        <p>Redirigiendo...</p>
      </main>
    );
  }

  const datosListos = solicitud !== undefined || Boolean(errorSolicitud);
  const hrefContinuar = '/estudiante/preinscripcion';
  const nombreNivel = nivelEfectivo === 'PREGRADO' ? 'pregrado' : 'posgrado';

  const tarjetaAviso = (
    <Card titulo="Antes de enviar" className={styles.aviso}>
      <p className={styles.avisoTexto}>
        CheckU prevalida tus documentos; no reemplaza la decisión oficial de la
        Universidad.
      </p>

      {politica ? (
        politica.limite > 0 ? (
          <p className={styles.reenvios}>
            <strong>Reenvíos de corrección hoy:</strong>{' '}
            {politica.limite - politica.usados} de {politica.limite}{' '}
            disponibles
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

  const filaRequisito = (requisito: RequisitoResumen) => {
    const puedeSubir =
      requisito.estado === 'falta_cargar' || requisito.resubmissionAllowed;
    const etiquetaAccion =
      requisito.estado === 'falta_cargar'
        ? 'Subir documento'
        : 'Subir nueva versión';

    return (
      <li key={requisito.clave} className={styles.documento}>
        <div className={styles.documentoInfo}>
          <div className={styles.documentoNombre}>
            <span>{requisito.nombre}</span>
            <StatusBadge
              estado={requisito.estado}
              etiqueta={ETIQUETA_PARA_ESTUDIANTE[requisito.estado]}
            />
          </div>

          {requisito.observaciones.map((observacion, indice) => (
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

  const tarjetaSolicitud = () => {
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
          <Button
            variante="secundario"
            onClick={() => {
              setIntento((valor) => valor + 1);
            }}
          >
            Reintentar
          </Button>
        </Card>
      );
    }

    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
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

        <ul className={styles.documentos}>
          {requisitos.map(filaRequisito)}
        </ul>
      </Card>
    );
  };

  return (
    <>
      <Navbar
        tipoUsuario={usuario.role}
        nombreUsuario={usuario.name}
        nivel={nivelEfectivo}
      />

      <main
        id="contenido"
        tabIndex={-1}
        className={styles.pagina}
        aria-busy={!datosListos}
      >
        <PageHeader
          etiqueta="PORTAL DE GRADOS"
          titulo={`¡Hola, ${usuario.name}!`}
          descripcion="Bienvenido a CheckU. Consulta información sobre tu proceso de solicitud de grado."
        />

        <section
          className={styles.bienvenida}
          aria-labelledby="titulo-bienvenida"
        >
          <div className={styles.bienvenidaPrincipal}>
            <span className={styles.bienvenidaIcono}>
              <Icono nombre="escudo" tamano={26} />
            </span>

            <div>
              <h2
                id="titulo-bienvenida"
                className={styles.bienvenidaTitulo}
              >
                Tu solicitud de grado está en curso
              </h2>

              <p className={styles.bienvenidaTexto}>
                Revisa el resultado del análisis documental de tu solicitud de{' '}
                {nombreNivel} y corrige los requisitos que lo necesiten.
              </p>
            </div>
          </div>

          <Button
            href={hrefContinuar}
            className={styles.bienvenidaAccion}
          >
            Continuar mi preinscripción
          </Button>
        </section>

        <div className={styles.rejillaConSolicitud}>
          <div className={styles.columna}>{tarjetaSolicitud()}</div>

          <div className={styles.columna}>
            {tarjetaAviso}
            <NotificacionesPanel />
          </div>
        </div>
      </main>
    </>
  );
}
