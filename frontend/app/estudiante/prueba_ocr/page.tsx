'use client';

import { useState } from 'react';
import { analizarDocumentos } from './api';
import type { NivelAcademico, ResultadoAnalisis } from './types';
import styles from './prueba-ocr.module.css';

const DOCUMENTOS_PREGRADO = [
  { campo: 'cedula', etiqueta: 'Cédula de ciudadanía' },
  { campo: 'evaluacion_grado', etiqueta: 'Evaluación de grado (Banner)' },
  { campo: 'paz_y_salvo', etiqueta: 'Paz y Salvo de Biblioteca' },
  { campo: 'estampilla', etiqueta: 'Estampilla Pro-Cultura' },
  { campo: 'saber_pro', etiqueta: 'Resultados Saber Pro' },
];

const DOCUMENTOS_POSGRADO = [
  { campo: 'cedula', etiqueta: 'Cédula de ciudadanía' },
  { campo: 'paz_y_salvo', etiqueta: 'Paz y Salvo de Biblioteca' },
  { campo: 'estampilla', etiqueta: 'Estampilla Pro-Cultura' },
];

const JSON_INICIAL = `{
  "nombres": "Ana María",
  "apellidos": "Pérez Gómez",
  "tipoDocumento": "CC",
  "numeroDocumento": "1001234567",
  "fechaNacimiento": "2001-05-14",
  "codigoEstudiantil": "T00012345",
  "programa": "Ingeniería de Sistemas",
  "correo": "ana.perez@utb.edu.co"
}`;

export default function PruebaOcrPage() {
  const [nivel, setNivel] = useState<NivelAcademico>('PREGRADO');
  const [datos, setDatos] = useState(JSON_INICIAL);
  const [archivos, setArchivos] = useState<Record<string, File | null>>({});
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentos =
    nivel === 'PREGRADO' ? DOCUMENTOS_PREGRADO : DOCUMENTOS_POSGRADO;

  function cambiarArchivo(campo: string, archivo: File | null) {
    setArchivos((previo) => ({ ...previo, [campo]: archivo }));
  }

  async function enviar() {
    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const formulario = new FormData();
      formulario.append('datos', datos);
      formulario.append('nivel', nivel);

      for (const documento of documentos) {
        const archivo = archivos[documento.campo];

        if (archivo) {
          formulario.append(documento.campo, archivo);
        }
      }

      const respuesta = await analizarDocumentos(formulario);
      setResultado(respuesta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className={styles.contenedor}>
      <h1 className={styles.titulo}>Playground de análisis documental</h1>
      <p className={styles.descripcion}>
        Página de prueba sin autenticación ni persistencia. Envía los datos y
        documentos al endpoint de análisis.
      </p>

      <section className={styles.tarjeta}>
        <h2 className={styles.subtitulo}>Nivel académico</h2>
        <select
          className={styles.selector}
          value={nivel}
          onChange={(e) => setNivel(e.target.value as NivelAcademico)}
        >
          <option value="PREGRADO">Pregrado</option>
          <option value="POSGRADO">Posgrado</option>
        </select>
      </section>

      <section className={styles.tarjeta}>
        <h2 className={styles.subtitulo}>Datos del estudiante (JSON)</h2>
        <textarea
          className={styles.json}
          value={datos}
          onChange={(e) => setDatos(e.target.value)}
          rows={12}
          spellCheck={false}
        />
      </section>

      <section className={styles.tarjeta}>
        <h2 className={styles.subtitulo}>Documentos</h2>
        <div className={styles.archivos}>
          {documentos.map((documento) => (
            <label key={documento.campo} className={styles.archivo}>
              <span className={styles.etiqueta}>{documento.etiqueta}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  cambiarArchivo(documento.campo, e.target.files?.[0] ?? null)
                }
              />
            </label>
          ))}
        </div>
      </section>

      <button
        className={styles.boton}
        onClick={enviar}
        disabled={cargando}
        type="button"
      >
        {cargando ? 'Analizando…' : 'Analizar documentos'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {resultado && (
        <section className={styles.tarjeta}>
          <h2 className={styles.subtitulo}>Resultado</h2>
          <pre className={styles.jsonResultado}>
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
