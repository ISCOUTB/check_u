'use client';

import { useState } from 'react';
import DocumentAnalysis, {
  type DocumentAnalysisData,
} from '@/app/components/document_analysis/DocumentAnalysis';
import Navbar from '@/app/components/navbar/Navbar';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Icono from '@/app/components/ui/Icono';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';
import Tabs from '@/app/components/ui/Tabs';
import { useSesion } from '@/app/lib/useSesion';
import {
  type Documento,
  documentAnalysisMock,
  documentos,
  estudiante,
} from './datos';
import styles from './detalle.module.css';
import {
  InformacionEstudiante,
  DEMO_PREGRADO,
  DEMO_POSGRADO,
} from '@/app/components/informacion_estudiante';

const CON_PROBLEMAS = documentos.filter((d) => d.estado !== 'valido');
const VALIDOS = documentos.filter((d) => d.estado === 'valido');

const ESTADO_GENERAL = documentos.some((d) => d.estado === 'por_revisar')
  ? {
      titulo: 'Por revisar',
      tono: 'revisar' as const,
      icono: 'por_revisar' as const,
    }
  : CON_PROBLEMAS.length > 0
    ? {
        titulo: 'Se requiere corregir documentos',
        tono: 'corregir' as const,
        icono: 'inconsistente' as const,
      }
    : {
        titulo: 'Preinscripción lista para continuar',
        tono: 'lista' as const,
        icono: 'valido' as const,
      };

const INICIALES = estudiante.nombre
  .split(' ')
  .slice(0, 2)
  .map((parte) => parte[0])
  .join('');

export default function DetallePreinscripcionPage() {
  const { usuario, cargando } = useSesion('funcionario');
  const [pestana, setPestana] = useState('resumen');
  const [analisis, setAnalisis] = useState<DocumentAnalysisData | null>(null);
  const [revisados, setRevisados] = useState<Record<string, boolean>>({});

  if (cargando || !usuario) {
    return (
      <main
        id="contenido"
        tabIndex={-1}
        className={styles.cargando}
        aria-busy="true"
      >
        <p>Verificando sesión...</p>
      </main>
    );
  }

  /** Desde una alerta: abre la pestaña Documentos y lleva el foco a ese documento. */
  const revisar = (documento: Documento) => {
    setPestana('documentos');
    requestAnimationFrame(() =>
      document.getElementById(`documento-${documento.id}`)?.focus(),
    );
  };

  const resumen = (
    <div className={styles.seccion}>
      <div className={styles.seccionEncabezado}>
        <h2>Resumen documental</h2>
        <p>
          Resultado general del análisis automático de los documentos
          suministrados.
        </p>
      </div>

      <dl className={styles.metricas}>
        <div className={styles.metrica}>
          <dt>Documentos analizados</dt>
          <dd className={styles.metricaValor}>{documentos.length}</dd>
          <dd>Documentos requeridos</dd>
        </div>
        <div className={styles.metrica} data-tono="valido">
          <dt>Válidos</dt>
          <dd className={styles.metricaValor}>{VALIDOS.length}</dd>
          <dd>Sin novedades</dd>
        </div>
        <div className={styles.metrica} data-tono="atencion">
          <dt>Requieren atención</dt>
          <dd className={styles.metricaValor}>{CON_PROBLEMAS.length}</dd>
          <dd>Con alertas</dd>
        </div>
        <div className={styles.metrica}>
          <dt>Nivel académico</dt>
          <dd className={styles.metricaValor}>{estudiante.nivel}</dd>
          <dd>Tipo de solicitud</dd>
        </div>
      </dl>

      {CON_PROBLEMAS.length > 0 && (
        <Card
          titulo="Alertas"
          nivelTitulo={3}
          acciones={
            <span className={styles.contador}>{CON_PROBLEMAS.length}</span>
          }
        >
          <p className={styles.textoSecundario}>
            Documentos que requieren revisión o corrección.
          </p>
          <ul className={styles.alertas}>
            {CON_PROBLEMAS.map((documento) => (
              <li key={documento.id} className={styles.alerta}>
                <span
                  className={styles.alertaIcono}
                  data-estado={documento.estado}
                >
                  <Icono nombre={documento.estado} />
                </span>
                <div className={styles.alertaTexto}>
                  <div className={styles.filaTitulo}>
                    <strong>{documento.nombre}</strong>
                    <StatusBadge estado={documento.estado} />
                  </div>
                  <p>{documento.mensaje}</p>
                </div>
                <Button
                  variante="secundario"
                  aria-label={`Revisar ${documento.nombre}`}
                  onClick={() => revisar(documento)}
                >
                  Revisar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card titulo="Estado de los documentos" nivelTitulo={3}>
        <p className={styles.textoSecundario}>
          Vista rápida del resultado de cada documento.
        </p>
        <ul className={styles.resumenDocumentos}>
          {documentos.map((documento) => (
            <li key={documento.id} className={styles.resumenDocumento}>
              <span className={styles.iconoDocumento}>
                <Icono nombre="documento" />
              </span>
              <div className={styles.resumenTexto}>
                <strong>{documento.nombre}</strong>
                <span>{documento.descripcion}</span>
              </div>
              <StatusBadge estado={documento.estado} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );

  const informacion = (
    <div className={styles.seccion}>
      <div className={styles.seccionEncabezado}>
        <h2>Información del estudiante</h2>
        <p>Información suministrada durante el proceso de preinscripción.</p>
      </div>
      {/*
            SIMULADO: DEMO_PREGRADO. TODO: datos reales por id de solicitud.
            */}
      <InformacionEstudiante
        nivel={estudiante.nivel === 'POSGRADO' ? 'POSGRADO' : 'PREGRADO'}
        datos={estudiante.nivel === 'POSGRADO' ? DEMO_POSGRADO : DEMO_PREGRADO}
        variante="funcionario"
      />
    </div>
  );

  const listaDocumentos = (
    <div className={styles.seccion}>
      <div className={styles.seccionEncabezado}>
        <h2>Documentos analizados</h2>
        <p>
          Detalle de los resultados obtenidos durante la validación documental.
        </p>
      </div>

      <ul className={styles.documentos}>
        {documentos.map((documento, indice) => (
          <li key={documento.id}>
            <article
              className={styles.documento}
              aria-labelledby={`documento-${documento.id}`}
            >
              <div className={styles.documentoCabecera}>
                <span className={styles.numero} aria-hidden="true">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <div className={styles.documentoTitulo}>
                  <h3 id={`documento-${documento.id}`} tabIndex={-1}>
                    {documento.nombre}
                  </h3>
                  <p>{documento.descripcion}</p>
                </div>
                <StatusBadge estado={documento.estado} />
              </div>
              <div className={styles.resultado}>
                <p className={styles.resultadoEtiqueta}>
                  Resultado del análisis
                </p>
                <p>{documento.mensaje}</p>
              </div>
              <div className={styles.acciones}>
                <Button
                  variante="secundario"
                  aria-label={`Ver análisis automático: ${documento.nombre}`}
                  onClick={() =>
                    setAnalisis(documentAnalysisMock[documento.id] ?? null)
                  }
                >
                  Ver análisis automático
                </Button>
                {documento.estado !== 'valido' && (
                  <Button
                    variante="sutil"
                    aria-pressed={!!revisados[documento.id]}
                    onClick={() =>
                      setRevisados((previos) => ({
                        ...previos,
                        [documento.id]: !previos[documento.id],
                      }))
                    }
                  >
                    {revisados[documento.id] && <Icono nombre="valido" />}
                    Marcar como revisado
                  </Button>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <Navbar tipoUsuario="funcionario" nombreUsuario={usuario.name} />
      <main id="contenido" tabIndex={-1} className={styles.pagina}>
        <PageHeader
          ruta={[
            { texto: 'Funcionarios' },
            { texto: 'Preinscripciones', href: '/funcionario/dashboard' },
            { texto: 'Detalle' },
          ]}
          titulo="Detalle de preinscripción"
          descripcion="Revisión documental de la solicitud de grado del estudiante."
        />

        <section
          className={styles.estudiante}
          aria-labelledby="nombre-estudiante"
        >
          <span className={styles.avatar} aria-hidden="true">
            {INICIALES}
          </span>
          <div className={styles.estudianteDatos}>
            <div className={styles.filaTitulo}>
              <h2 id="nombre-estudiante">{estudiante.nombre}</h2>
              <span className={styles.nivel}>{estudiante.nivel}</span>
            </div>
            <p className={styles.programa}>{estudiante.programa}</p>
            <dl className={styles.meta}>
              <div>
                <dt>Código</dt>
                <dd>{estudiante.codigo}</dd>
              </div>
              <div>
                <dt>{estudiante.tipoDocumento}</dt>
                <dd>{estudiante.numeroDocumento}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{estudiante.correo}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{estudiante.telefono}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section
          className={styles.estadoGeneral}
          data-tono={ESTADO_GENERAL.tono}
          aria-labelledby="estado-general"
        >
          <span className={styles.estadoIcono}>
            <Icono nombre={ESTADO_GENERAL.icono} tamano={22} />
          </span>
          <div>
            <p className={styles.estadoEtiqueta}>Estado general</p>
            <h2 id="estado-general">{ESTADO_GENERAL.titulo}</h2>
            <p>
              {CON_PROBLEMAS.length > 0
                ? `${CON_PROBLEMAS.length} ${
                    CON_PROBLEMAS.length === 1
                      ? 'documento requiere'
                      : 'documentos requieren'
                  } atención antes de continuar con el proceso.`
                : 'Todos los documentos requeridos fueron validados correctamente.'}
            </p>
          </div>
        </section>

        <Tabs
          etiqueta="Secciones de la preinscripción"
          activa={pestana}
          alCambiar={setPestana}
          pestanas={[
            { id: 'resumen', titulo: 'Resumen documental', contenido: resumen },
            {
              id: 'estudiante',
              titulo: 'Información del estudiante',
              contenido: informacion,
            },
            {
              id: 'documentos',
              titulo: 'Documentos',
              contenido: listaDocumentos,
            },
          ]}
        />
      </main>

      <DocumentAnalysis
        open={analisis !== null}
        onClose={() => setAnalisis(null)}
        data={analisis}
      />
    </>
  );
}
