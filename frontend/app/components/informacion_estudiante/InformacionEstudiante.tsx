'use client';

import { gruposPorNivel } from './campos';
import styles from './InformacionEstudiante.module.css';
import type {
  DatosInformacionEstudiante,
  FormatoCampo,
  PropsInformacionEstudiante,
} from './types';

function esVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

function formatearDocumento(valor: string): string {
  return valor.replace(/[\s.,]/g, '');
}

function formatearFechaParaInput(isoDia: string): string {
  // Asegura formato YYYY-MM-DD para el input type="date"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDia.trim());
  return m ? isoDia.trim() : '';
}

function formatearActualizacion(valor: string): string {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(d);
}

function obtenerValorParaInput(valor: unknown, formato: FormatoCampo): string {
  if (esVacio(valor)) return '';

  if (typeof valor === 'boolean') {
    return valor ? 'true' : 'false';
  }

  const raw = String(valor);

  if (formato === 'documento') return formatearDocumento(raw);
  if (formato === 'fecha') return formatearFechaParaInput(raw);
  if (formato === 'mayusculas') return raw.toUpperCase();

  return raw;
}

const CLAVES_BOOLEANAS = new Set([
  'conoceRegistroSaberPro',
  'esEmpleadoUtb',
  'esHijoEmpleadoUtb',
  'esEgresadoPregradoUtb',
]);

export default function InformacionEstudiante({
  nivel,
  datos,
  variante,
}: PropsInformacionEstudiante) {
  const grupos = gruposPorNivel(nivel).filter(
    (g) => !g.visibleSi || g.visibleSi(datos),
  );

  return (
    <div className={styles.raiz}>
      {variante === 'funcionario' && datos.ultimaActualizacion && (
        <p className={styles.metaFuncionario}>
          Última actualización:{' '}
          {formatearActualizacion(datos.ultimaActualizacion)}
        </p>
      )}

      {grupos.map((grupo) => {
        const campos = grupo.campos.filter(
          (c) => !c.visibleSi || c.visibleSi(datos),
        );

        return (
          <section
            key={grupo.id}
            className={styles.grupo}
            aria-labelledby={`info-${grupo.id}`}
          >
            <h3 id={`info-${grupo.id}`} className={styles.tituloGrupo}>
              {grupo.titulo}
            </h3>

            <div className={styles.lista}>
              {campos.map((campo) => {
                const bruto =
                  datos[campo.clave as keyof DatosInformacionEstudiante];
                const esLista = campo.formato === 'lista';
                const ancho =
                  esLista ||
                  campo.clave === 'direccion' ||
                  campo.clave === 'programa' ||
                  campo.clave === 'segundoPrograma';

                // Caso especial: lista de cargos
                if (esLista) {
                  const items = Array.isArray(bruto) ? bruto : [];
                  const lineas = items.map((item) => {
                    if (item && typeof item === 'object' && 'cargo' in item) {
                      const c = item as {
                        cargo: string;
                        empresa: string;
                        tiempo: string;
                      };
                      return `${c.cargo} - ${c.empresa} - ${c.tiempo}`;
                    }
                    return String(item);
                  });

                  return (
                    <div
                      key={String(campo.clave)}
                      className={`${styles.campo} ${styles.campoAncho}`}
                    >
                      <label
                        className={styles.etiqueta}
                        htmlFor={String(campo.clave)}
                      >
                        {campo.etiqueta}
                      </label>
                      <textarea
                        id={String(campo.clave)}
                        className={styles.input}
                        value={lineas.join('\n')}
                        disabled
                        rows={Math.max(2, lineas.length)}
                        readOnly
                      />
                    </div>
                  );
                }

                // Booleanos → select Sí/No
                if (
                  CLAVES_BOOLEANAS.has(String(campo.clave)) ||
                  typeof bruto === 'boolean'
                ) {
                  const valor =
                    bruto === true ? 'true' : bruto === false ? 'false' : '';

                  return (
                    <div
                      key={String(campo.clave)}
                      className={
                        ancho
                          ? `${styles.campo} ${styles.campoAncho}`
                          : styles.campo
                      }
                    >
                      <label
                        className={styles.etiqueta}
                        htmlFor={String(campo.clave)}
                      >
                        {campo.etiqueta}
                      </label>
                      <select
                        id={String(campo.clave)}
                        className={styles.input}
                        value={valor}
                        disabled
                      >
                        <option value="">Selecciona</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  );
                }

                // Resto de campos → input
                const valorInput = obtenerValorParaInput(bruto, campo.formato);
                const tipoInput = campo.formato === 'fecha' ? 'date' : 'text';

                return (
                  <div
                    key={String(campo.clave)}
                    className={
                      ancho
                        ? `${styles.campo} ${styles.campoAncho}`
                        : styles.campo
                    }
                  >
                    <label className={styles.etiqueta} htmlFor={campo.clave}>
                      {campo.etiqueta}
                    </label>
                    <input
                      id={campo.clave}
                      type={tipoInput}
                      className={styles.input}
                      value={valorInput}
                      disabled
                      readOnly
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
