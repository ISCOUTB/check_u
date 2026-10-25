'use client';

import { useMemo, useState } from 'react';
import styles from './prueba_ocr.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

type Nivel = 'PREGRADO' | 'POSGRADO';

/** Tipos que el motor ya sabe validar hoy */
const SOPORTADOS = new Set([
  'identification',
  'saber_pro',
  'estampilla_pro_cultura',
]);

const DOCS_POR_NIVEL: Record<Nivel, { tipo: string; etiqueta: string }[]> = {
  PREGRADO: [
    { tipo: 'identification', etiqueta: 'Cédula de ciudadanía' },
    { tipo: 'academic_evaluation', etiqueta: 'Evaluación de Grado (Banner)' },
    { tipo: 'estampilla_pro_cultura', etiqueta: 'Estampilla Pro-Cultura' },
    { tipo: 'saber_pro', etiqueta: 'Resultados Saber Pro' },
    { tipo: 'paz_y_salvo_bib', etiqueta: 'Paz y Salvo de Biblioteca' },
  ],
  POSGRADO: [
    { tipo: 'identification', etiqueta: 'Documento de identidad' },
    { tipo: 'estampilla_pro_cultura', etiqueta: 'Estampilla Pro-Cultura' },
    { tipo: 'paz_y_salvo_bib', etiqueta: 'Paz y Salvo de Biblioteca' },
  ],
};

const ESTUDIANTE_DEMO = {
  id_student: 'T00012345',
  nivel: 'PREGRADO',
  nombres: 'Humberto',
  apellidos: 'Rodríguez Sánchez',
  numero_documento: '1104698087',
};

type ResultadoDoc = {
  type_document?: string;
  document_classification?: string;
  required_action?: string;
  extracted_data?: Record<
    string,
    { value: string | number | boolean | null; confidence: number | null }
  >;
  rules?: {
    rule: string;
    result: string;
    mandatory: boolean;
    message: string;
    no_evaluable_reason?: string | null;
  }[];
  errors?: string[];
  validation_version?: string;
};

type RespuestaAnalisis = {
  id_student?: string;
  nivel?: string;
  estado_general?: string;
  resultados?: ResultadoDoc[];
  errores?: {
    indice: number;
    nombre?: string;
    type_document?: string;
    error: string;
  }[];
};

const ETIQUETA_TIPO: Record<string, string> = {
  identification: 'Cédula / identificación',
  saber_pro: 'Saber Pro',
  estampilla_pro_cultura: 'Estampilla Pro-Cultura',
  academic_evaluation: 'Evaluación de Grado',
  paz_y_salvo_bib: 'Paz y Salvo Biblioteca',
};

const ETIQUETA_CLASE: Record<string, string> = {
  valid: 'Válido',
  invalid: 'No válido',
  to_check: 'Por revisar',
  inconsistent: 'Inconsistente',
};

const ETIQUETA_CAMPO: Record<string, string> = {
  full_name: 'Nombre completo',
  identification_number: 'Número de documento',
  identification_type: 'Tipo de documento',
  birth_date: 'Fecha de nacimiento',
  sex: 'Sexo',
};

const ETIQUETA_REGLA: Record<string, string> = {
  identification_document: 'Documento de identidad',
  required_fields_present: 'Campos obligatorios',
  machine_readable_code: 'Código legible por máquina',
  image_quality: 'Calidad de imagen',
  rui_name_match: 'Coincidencia con RUI',
};

const ETIQUETA_RESULTADO: Record<string, string> = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  no_evaluable: 'No evaluable',
};

const ETIQUETA_ACCION: Record<string, string> = {
  none: 'Ninguna',
  wait_for_review: 'Esperar revisión',
  wait_for_external_validation: 'Esperar validación externa',
  upload_new_version: 'Subir nueva versión',
  correct_data: 'Corregir datos',
  contact_administration: 'Contactar administración',
};

function claseEstado(c?: string) {
  if (c === 'valid') return styles.ok;
  if (c === 'invalid') return styles.bad;
  if (c === 'inconsistent') return styles.warn;
  return styles.check;
}

export default function PruebaOcrPage() {
  const [nivel, setNivel] = useState<Nivel>('PREGRADO');
  const [jsonTexto, setJsonTexto] = useState(
    JSON.stringify({ ...ESTUDIANTE_DEMO, nivel: 'PREGRADO' }, null, 2),
  );
  const [archivos, setArchivos] = useState<Record<string, File | null>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaAnalisis | null>(null);
  const [verJson, setVerJson] = useState(false);

  const documentos = useMemo(() => DOCS_POR_NIVEL[nivel], [nivel]);

  function cambiarNivel(n: Nivel) {
    setNivel(n);
    try {
      const actual = JSON.parse(jsonTexto) as Record<string, unknown>;
      setJsonTexto(JSON.stringify({ ...actual, nivel: n }, null, 2));
    } catch {
      setJsonTexto(JSON.stringify({ ...ESTUDIANTE_DEMO, nivel: n }, null, 2));
    }
    setArchivos({});
    setRespuesta(null);
    setError(null);
  }

  function onFile(tipo: string, file: File | null) {
    setArchivos((prev) => ({ ...prev, [tipo]: file }));
  }

  async function enviar() {
    setError(null);
    setRespuesta(null);

    let estudiante: Record<string, unknown>;
    try {
      estudiante = JSON.parse(jsonTexto) as Record<string, unknown>;
    } catch {
      setError('El JSON del estudiante no es válido.');
      return;
    }

    if (!estudiante.id_student) {
      setError('El JSON debe incluir id_student.');
      return;
    }

    const pares = documentos.filter(
      (d) => SOPORTADOS.has(d.tipo) && archivos[d.tipo],
    );

    if (pares.length === 0) {
      setError(
        'Adjunta al menos un documento de un tipo soportado por el motor (cédula, Saber Pro o estampilla).',
      );
      return;
    }

    const form = new FormData();
    form.append('estudiante', JSON.stringify({ ...estudiante, nivel }));
    form.append('tipos', pares.map((p) => p.tipo).join(','));
    for (const p of pares) {
      const file = archivos[p.tipo];
      if (file) form.append('documentos', file, file.name);
    }

    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/documentos/analizar`, {
        method: 'POST',
        body: form,
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'message' in data &&
          typeof (data as { message: unknown }).message === 'string'
            ? (data as { message: string }).message
            : `Error HTTP ${res.status}`;
        setError(msg);
        setRespuesta(data as RespuestaAnalisis);
        setVerJson(false);
        return;
      }
      setRespuesta(data as RespuestaAnalisis);
      setVerJson(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo conectar con el backend.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={styles.page} id="contenido" tabIndex={-1}>
      <header className={styles.header}>
        <p className={styles.badge}>Playground · sin login ni persistencia</p>
        <h1>Prueba OCR / validación documental</h1>
        <p className={styles.sub}>
          Envía datos del estudiante y documentos a{' '}
          <code>POST /api/documentos/analizar</code>. Solo se procesan tipos que
          el motor ya soporta.
        </p>
      </header>

      <section className={styles.card}>
        <h2>1. Nivel académico</h2>
        <div className={styles.row}>
          {(['PREGRADO', 'POSGRADO'] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={nivel === n ? styles.chipActivo : styles.chip}
              onClick={() => cambiarNivel(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>2. Datos del estudiante (JSON)</h2>
        <textarea
          className={styles.json}
          rows={10}
          value={jsonTexto}
          onChange={(e) => setJsonTexto(e.target.value)}
          spellCheck={false}
        />
      </section>

      <section className={styles.card}>
        <h2>3. Documentos</h2>
        <ul className={styles.listaDocs}>
          {documentos.map((doc) => {
            const ok = SOPORTADOS.has(doc.tipo);
            return (
              <li key={doc.tipo} className={styles.docItem}>
                <div>
                  <strong>{doc.etiqueta}</strong>
                  <span className={styles.tipo}>{doc.tipo}</span>
                  {!ok && (
                    <span className={styles.aviso}>
                      Motor aún no soportado — no se enviará
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={!ok || enviando}
                  onChange={(e) =>
                    onFile(doc.tipo, e.target.files?.[0] ?? null)
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>

      <div className={styles.acciones}>
        <button
          type="button"
          className={styles.primary}
          disabled={enviando}
          onClick={() => void enviar()}
        >
          {enviando ? 'Analizando…' : 'Analizar documentos'}
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {respuesta != null && (
        <section className={styles.card}>
          <h2>4. Resultados</h2>

          <div className={styles.resumen}>
            <span>
              Estudiante: <strong>{respuesta.id_student ?? '—'}</strong>
            </span>
            <span>
              Nivel: <strong>{respuesta.nivel ?? '—'}</strong>
            </span>
            <span className={claseEstado(respuesta.estado_general)}>
              Estado general:{' '}
              <strong>
                {ETIQUETA_CLASE[respuesta.estado_general ?? ''] ??
                  respuesta.estado_general ??
                  '—'}
              </strong>
            </span>
          </div>

          {(respuesta.errores?.length ?? 0) > 0 && (
            <div className={styles.error}>
              <strong>Errores de envío</strong>
              <ul>
                {respuesta.errores!.map((e, i) => (
                  <li key={i}>
                    [{e.type_document ?? e.indice}] {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.tarjetas}>
            {(respuesta.resultados ?? []).map((doc, i) => (
              <article key={i} className={styles.tarjeta}>
                <header className={styles.tarjetaHeader}>
                  <div>
                    <h3>
                      {ETIQUETA_TIPO[doc.type_document ?? ''] ??
                        doc.type_document ??
                        `Documento ${i + 1}`}
                    </h3>
                    <p className={styles.meta}>
                      {doc.validation_version ?? ''}
                      {doc.required_action
                        ? ` · Acción: ${
                            ETIQUETA_ACCION[doc.required_action] ??
                            doc.required_action
                          }`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`${styles.badgeEstado} ${claseEstado(
                      doc.document_classification,
                    )}`}
                  >
                    {ETIQUETA_CLASE[doc.document_classification ?? ''] ??
                      doc.document_classification ??
                      '—'}
                  </span>
                </header>

                <div className={styles.bloque}>
                  <h4>Datos extraídos</h4>
                  <dl className={styles.datos}>
                    {Object.entries(doc.extracted_data ?? {}).map(
                      ([campo, dato]) => (
                        <div key={campo} className={styles.dato}>
                          <dt>{ETIQUETA_CAMPO[campo] ?? campo}</dt>
                          <dd>
                            {dato.value == null ? (
                              <em className={styles.vacio}>Sin dato</em>
                            ) : (
                              String(dato.value)
                            )}
                            {dato.confidence != null && (
                              <span className={styles.conf}>
                                {' '}
                                ({Math.round(dato.confidence * 100)}%)
                              </span>
                            )}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>

                <div className={styles.bloque}>
                  <h4>Reglas</h4>
                  <ul className={styles.reglas}>
                    {(doc.rules ?? []).map((r) => (
                      <li key={r.rule} className={styles.regla}>
                        <div className={styles.reglaTop}>
                          <code>{ETIQUETA_REGLA[r.rule] ?? r.rule}</code>
                          <span
                            className={
                              r.result === 'cumple'
                                ? styles.ok
                                : r.result === 'no_cumple'
                                  ? styles.bad
                                  : styles.check
                            }
                          >
                            {ETIQUETA_RESULTADO[r.result] ?? r.result}
                            {r.mandatory ? ' · obligatoria' : ' · informativa'}
                          </span>
                        </div>
                        <p>{r.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            className={styles.chip}
            onClick={() => setVerJson((v) => !v)}
          >
            {verJson ? 'Ocultar JSON' : 'Ver JSON completo'}
          </button>

          {verJson && (
            <pre className={styles.pre}>
              {JSON.stringify(respuesta, null, 2)}
            </pre>
          )}
        </section>
      )}
    </main>
  );
}
