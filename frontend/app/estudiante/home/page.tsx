'use client';

import { useEffect, useState } from 'react';
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
  type DocumentoSolicitud,
  type EstadoDocumentoCompleto,
  type NivelAcademico,
  type PoliticaReenvios,
  type Solicitud,
  DOCUMENTOS_POR_NIVEL,
  obtenerNivelSimulado,
  obtenerPoliticaReenvios,
  obtenerSolicitudActiva,
} from './api';

/** El estudiante ve "Corrección requerida" donde el sistema dice "No válido". */
const ETIQUETA_PARA_ESTUDIANTE: Partial<
  Record<EstadoDocumentoCompleto, string>
> = {
  no_valido: 'Corrección requerida',
};

const DETALLE_ESTADO: Partial<Record<EstadoDocumentoCompleto, string>> = {
  valido: 'Cumple los requisitos revisados.',
  por_revisar: 'En revisión; no necesitas hacer nada.',
  falta_cargar: 'Aún no has cargado este documento.',
  inconsistente: 'Inconsistencia detectada entre documentos.',
  procesando: 'Procesando y validando documento...',
};

function documentosCargados(solicitud: Solicitud): number {
  return solicitud.documentos.filter((d) => d.estado !== 'falta_cargar')
    .length;
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

  const [nivel, setNivel] = useState<NivelAcademico | null>(null);
  const [solicitud, setSolicitud] = useState<Solicitud | null | undefined>(
    undefined,
  );
  const [politica, setPolitica] = useState<PoliticaReenvios | null>(null);

  // Redirigir según el estado real de la solicitud.
  useEffect(() => {
    if (!estadoNav?.destino) return;

    if (estadoNav.destino !== pathname) {
      router.replace(estadoNav.destino);
    }
  }, [estadoNav, pathname, router]);

  // Cargar información del portal cuando la solicitud está enviada.
  useEffect(() => {
    if (!usuario || estadoNav?.estado !== 'ENVIADA') return;

    obtenerNivelSimulado().then(setNivel);

    obtenerSolicitudActiva()
      .then(setSolicitud)
      .catch(() => {
        setSolicitud(null);
      });

    obtenerPoliticaReenvios()
      .then(setPolitica)
      .catch(() => setPolitica(null));
  }, [usuario, estadoNav?.estado]);

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

  const datosListos = solicitud !== undefined;
  const nivelEfectivo: NivelAcademico =
    nivel ?? usuario.nivel ?? 'PREGRADO';

  const nombreNivel =
    nivelEfectivo === 'PREGRADO' ? 'pregrado' : 'posgrado';

  const listaDocs = DOCUMENTOS_POR_NIVEL[nivelEfectivo] || [];
  const hrefContinuar = '/estudiante/preinscripcion';

  const tarjetaDocumentos = (
    <Card titulo={`Documentos de ${nombreNivel} · ${listaDocs.length}`}>
      {listaDocs.length > 0 ? (
        <ul className={styles.listaRequisitos}>
          {listaDocs.map((nombre, index) => (
            <li key={`${nombre}-${index}`}>{nombre}</li>
          ))}
        </ul>
      ) : (
        <p>No se encontraron documentos para el nivel {nivelEfectivo}.</p>
      )}
    </Card>
  );

  const tarjetaAviso = (
    <Card titulo="Antes de enviar" className={styles.aviso}>
      <p className={styles.avisoTexto}>
        CheckU prevalida tus documentos; no reemplaza la decisión oficial de la
        Universidad.
      </p>

      {politica ? (
        <p className={styles.reenvios}>
          <strong>Reenvíos de corrección hoy:</strong>{' '}
          {politica.limite - politica.usados} de {politica.limite} disponibles
        </p>
      ) : (
        <p className={styles.textoSecundario}>
          Cargando política de reenvíos...
        </p>
      )}
    </Card>
  );

  const filaDocumento = (doc: DocumentoSolicitud) => (
    <li key={doc.tipo} className={styles.documento}>
      <div className={styles.documentoInfo}>
        <div className={styles.documentoNombre}>
          <span>{doc.nombre}</span>
          <StatusBadge
            estado={doc.estado}
            etiqueta={ETIQUETA_PARA_ESTUDIANTE[doc.estado]}
          />
        </div>

        {doc.estado === 'no_valido' && doc.motivoRechazo ? (
          <p className={styles.motivo}>{doc.motivoRechazo}</p>
        ) : (
          DETALLE_ESTADO[doc.estado] && (
            <p className={styles.documentoDetalle}>
              {DETALLE_ESTADO[doc.estado]}
            </p>
          )
        )}
      </div>

      {(doc.estado === 'falta_cargar' || doc.correccionAutorizada) && (
        <Button
          href="/estudiante/preinscripcion"
          variante="secundario"
          className={styles.documentoAccion}
          aria-label={`${
            doc.estado === 'falta_cargar'
              ? 'Subir documento'
              : 'Subir nueva versión'
          }: ${doc.nombre}`}
        >
          {doc.estado === 'falta_cargar'
            ? 'Subir documento'
            : 'Subir nueva versión'}
        </Button>
      )}
    </li>
  );

  const tarjetaSolicitud = () => {
    if (solicitud === undefined) {
      return (
        <Card titulo="Mi solicitud de grado" id="mi-solicitud">
          <p className={styles.textoSecundario}>Cargando solicitud...</p>
        </Card>
      );
    }

    if (!solicitud) {
      return (
        <Card titulo="Mi solicitud de grado" id="mi-solicitud">
          <p className={styles.textoError}>
            No fue posible cargar la solicitud. Intenta recargar la página.
          </p>
        </Card>
      );
    }

    const cargados = documentosCargados(solicitud);
    const total = solicitud.documentos.length;

    return (
      <Card titulo="Mi solicitud de grado" id="mi-solicitud">
        <p className={styles.progresoTexto}>
          {cargados} de {total} documentos cargados
        </p>

        <div
          className={styles.progreso}
          role="progressbar"
          aria-label="Progreso de documentos cargados"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={cargados}
          aria-valuetext={`${cargados} de ${total} documentos cargados`}
        >
          <div
            className={styles.progresoRelleno}
            style={{
              transform: `scaleX(${total ? cargados / total : 0})`,
            }}
          />
        </div>

        <ul className={styles.documentos}>
          {solicitud.documentos.map(filaDocumento)}
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
                Sube los documentos que faltan y revisa si cumplen los
                requisitos antes de la inscripción formal.
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
          <div className={styles.columna}>
            {tarjetaDocumentos}
            {tarjetaSolicitud()}
          </div>

          <div className={styles.columna}>
            {tarjetaAviso}
            <NotificacionesPanel />
          </div>
        </div>
      </main>
    </>
  );
}