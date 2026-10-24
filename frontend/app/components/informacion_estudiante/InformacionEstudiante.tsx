"use client";

import { gruposPorNivel } from "./campos";
import styles from "./InformacionEstudiante.module.css";
import type {
  DatosInformacionEstudiante,
  FormatoCampo,
  PropsInformacionEstudiante,
} from "./types";

const TEXTO_VACIO = "No registrado";

function esVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

function formatearBooleano(valor: boolean): string {
  return valor ? "Sí" : "No";
}

/** Interpreta AAAA-MM-DD como fecha local (sin desfase UTC). */
function formatearFecha(isoDia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDia.trim());
  if (!m) return isoDia;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function formatearDocumento(valor: string): string {
  return valor.replace(/[\s.,]/g, "");
}

function valorComoTexto(
  valor: unknown,
  formato: FormatoCampo
): { texto: string; lista?: string[]; vacio: boolean } {
  if (typeof valor === "boolean") {
    return { texto: formatearBooleano(valor), vacio: false };
  }

  if (formato === "lista" && Array.isArray(valor)) {
    const lineas = valor.map((item) => {
      if (item && typeof item === "object" && "cargo" in item) {
        const c = item as { cargo: string; empresa: string; tiempo: string };
        return `${c.cargo} - ${c.empresa} - ${c.tiempo}`;
      }
      return String(item);
    });
    if (lineas.length === 0) return { texto: TEXTO_VACIO, vacio: true };
    return { texto: "", lista: lineas, vacio: false };
  }

  if (esVacio(valor)) {
    return { texto: TEXTO_VACIO, vacio: true };
  }

  const raw = String(valor);
  if (formato === "documento") return { texto: formatearDocumento(raw), vacio: false };
  if (formato === "fecha") return { texto: formatearFecha(raw), vacio: false };
  if (formato === "mayusculas") return { texto: raw.toUpperCase(), vacio: false };
  return { texto: raw, vacio: false };
}

function formatearActualizacion(valor: string): string {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(d);
}

export default function InformacionEstudiante({
  nivel,
  datos,
  variante,
}: PropsInformacionEstudiante) {
  const grupos = gruposPorNivel(nivel).filter(
    (g) => !g.visibleSi || g.visibleSi(datos)
  );

  return (
    <div className={styles.raiz}>
      {variante === "funcionario" && datos.ultimaActualizacion && (
        <p className={styles.metaFuncionario}>
          Última actualización: {formatearActualizacion(datos.ultimaActualizacion)}
        </p>
      )}

      {grupos.map((grupo) => {
        const campos = grupo.campos.filter(
          (c) => !c.visibleSi || c.visibleSi(datos)
        );
        return (
          <section key={grupo.id} className={styles.grupo} aria-labelledby={`info-${grupo.id}`}>
            <h3 id={`info-${grupo.id}`} className={styles.tituloGrupo}>
              {grupo.titulo}
            </h3>
            <dl className={styles.lista}>
              {campos.map((campo) => {
                const bruto = datos[campo.clave as keyof DatosInformacionEstudiante];
                const { texto, lista, vacio } = valorComoTexto(bruto, campo.formato);
                const ancho =
                  campo.formato === "lista" ||
                  campo.clave === "direccion" ||
                  campo.clave === "programa" ||
                  campo.clave === "segundoPrograma";

                return (
                  <div
                    key={String(campo.clave)}
                    className={ancho ? `${styles.campo} ${styles.campoAncho}` : styles.campo}
                  >
                    <dt className={styles.etiqueta}>{campo.etiqueta}</dt>
                    <dd
                      className={
                        vacio ? `${styles.valor} ${styles.valorVacio}` : styles.valor
                      }
                    >
                      {lista ? (
                        <ul className={styles.listaValores}>
                          {lista.map((linea) => (
                            <li key={linea}>{linea}</li>
                          ))}
                        </ul>
                      ) : (
                        texto
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </div>
  );
}