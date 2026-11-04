'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Navbar from '@/app/components/navbar/Navbar';
import Button from '@/app/components/ui/Button';
import PageHeader from '@/app/components/ui/PageHeader';

import { useEstadoNavegacion } from '@/app/lib/useEstadoNavegacion';
import { useSesion } from '@/app/lib/useSesion';
import { desplazarAAncla } from '@/app/lib/anclas';

import { obtenerSolicitudes } from '../solicitudes/api';
import type { SolicitudListado } from '../solicitudes/listado';
import type { NivelAcademico } from '../documentos-requeridos';

import styles from './home.module.css';
import BotonSolicitudes from './BotonSolicitudes';
import NotificacionesPanel from './NotificacionesPanel';
import SeccionBienvenida from './SeccionBienvenida';
import TarjetaAviso from './TarjetaAviso';
import TarjetaSolicitudReciente from './TarjetaSolicitudReciente';

import {
  ErrorConsultaSolicitud,
  obtenerSolicitudDetalle,
  type SolicitudDetalle,
} from './api';

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

  const [resumenListado, setResumenListado] = useState<{
    total: number;
    reciente: SolicitudListado | null;
    hayActiva: boolean;
    error: string | null;
  } | null>(null);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!estadoNav?.destino) return;
    if (estadoNav.destino !== pathname) {
      router.replace(estadoNav.destino);
    }
  }, [estadoNav, pathname, router]);

  useEffect(() => {
    if (!usuario) return;
    if (estadoNav?.estado === 'BORRADOR') return;

    const ac = new AbortController();
    let vigente = true;

    obtenerSolicitudes(ac.signal)
      .then((lista) => {
        if (!vigente) return;
        setResumenListado({
          total: lista.length,
          reciente: lista[0] ?? null,
          hayActiva: lista.some((solicitud) => solicitud.activa),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!vigente || esCancelacion(error)) return;
        setResumenListado({
          total: 0,
          reciente: null,
          hayActiva: false,
          error:
            error instanceof Error
              ? error.message
              : 'No fue posible consultar tus solicitudes.',
        });
      });

    return () => {
      vigente = false;
      ac.abort();
    };
  }, [usuario, estadoNav?.estado, intento]);

  const idReciente = resumenListado?.reciente?.id ?? null;

  useEffect(() => {
    if (!idReciente) {
      setDetalle(null);
      return;
    }

    const ac = new AbortController();
    let vigente = true;
    const clave = `reciente:${idReciente}:${intento}`;

    obtenerSolicitudDetalle(ac.signal, idReciente)
      .then((solicitud) => {
        if (vigente) setDetalle({ clave, solicitud, error: null });
      })
      .catch((error: unknown) => {
        if (!vigente || esCancelacion(error)) return;
        if (error instanceof ErrorConsultaSolicitud && error.status === 404) {
          setDetalle({ clave, solicitud: null, error: null });
          return;
        }
        setDetalle({
          clave,
          solicitud: null,
          error:
            'No fue posible cargar el resumen de tu solicitud. Intenta recargar la página.',
        });
      });

    return () => {
      vigente = false;
      ac.abort();
    };
  }, [idReciente, intento]);

  const detalleVigente =
    detalle &&
    idReciente &&
    detalle.clave === `reciente:${idReciente}:${intento}`
      ? detalle
      : null;

  const solicitud = detalleVigente?.solicitud;
  const errorSolicitud = detalleVigente?.error ?? null;

  const nivelEfectivo: NivelAcademico =
    solicitud?.estudiante.nivel ??
    estadoNav?.nivel ??
    usuario?.nivel ??
    'PREGRADO';

  const cargando =
    cargandoSesion || (Boolean(usuario) && cargandoEstado && !errorEstado);

  const datosListos =
    resumenListado !== null &&
    (resumenListado.reciente === null ||
      solicitud !== undefined ||
      Boolean(errorSolicitud));

  /**
   * El navegador y Next.js solo desplazan al ancla cuando el destino ya existe.
   * Al entrar con `#notificaciones` (o al navegar desde otra página) el home
   * muestra primero "Verificando sesión...", así que el desplazamiento se
   * repite cuando el contenido ya está montado.
   */
  useEffect(() => {
    if (!usuario || cargando || errorEstado || !datosListos) return;

    const irAlAncla = () => {
      desplazarAAncla(window.location.hash);
    };

    irAlAncla();
    window.addEventListener('hashchange', irAlAncla);
    return () => window.removeEventListener('hashchange', irAlAncla);
  }, [usuario, cargando, errorEstado, datosListos]);

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

  const hrefContinuar = '/estudiante/preinscripcion';
  const nombreNivel = nivelEfectivo === 'PREGRADO' ? 'pregrado' : 'posgrado';

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
          acciones={
            resumenListado && resumenListado.total > 0 ? (
              <>
                <BotonSolicitudes />
                {!resumenListado.hayActiva && (
                  <Button href="/estudiante/bienvenida" variante="secundario">
                    Nueva preinscripción
                  </Button>
                )}
              </>
            ) : undefined
          }
        />

        <SeccionBienvenida
          nombreNivel={nombreNivel}
          reciente={resumenListado?.reciente}
          hrefContinuar={hrefContinuar}
        />

        <div className={styles.rejillaConSolicitud}>
          <div className={styles.columna}>
            <TarjetaSolicitudReciente
              resumenListado={resumenListado}
              solicitud={solicitud}
              errorSolicitud={errorSolicitud}
              nivelEfectivo={nivelEfectivo}
              hrefContinuar={hrefContinuar}
              onReintentar={() => setIntento((v) => v + 1)}
            />
          </div>

          <div className={styles.columna}>
            <TarjetaAviso
              solicitud={solicitud}
              errorSolicitud={errorSolicitud}
            />
            <NotificacionesPanel />
          </div>
        </div>
      </main>
    </>
  );
}
