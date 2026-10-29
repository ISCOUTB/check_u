/**
 * Lectura de CSV para importar opciones desde Excel.
 *
 * Acepta coma o punto y coma como separador (Excel en español usa `;`), BOM,
 * comillas dobles y una fila de encabezado opcional. La primera columna es el
 * nombre visible; la segunda, si existe, el valor interno.
 */

export interface FilaCsvOpcion {
  /** Número de línea en el archivo original, empezando en 1. */
  linea: number;
  etiqueta: string;
  valor?: string;
}

export interface CsvOpciones {
  filas: FilaCsvOpcion[];
  /** Líneas con separadores pero sin ningún dato. */
  vacias: number[];
}

const ENCABEZADOS = new Set(['etiqueta', 'opcion', 'opción', 'nombre', 'opciones', 'valor visible']);

export function parsearCsvOpciones(texto: string): CsvOpciones {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const soloSeparadores = /^[\s,;]*$/;
  const primeraNoVacia = lineas.find((linea) => !soloSeparadores.test(linea)) ?? '';
  const delimitador = detectarDelimitador(primeraNoVacia);
  const filas: FilaCsvOpcion[] = [];
  const vacias: number[] = [];
  let esPrimeraFila = true;

  lineas.forEach((linea, indice) => {
    if (linea.trim() === '') return;

    // Una línea con solo comas, punto y coma o espacios no es un registro.
    if (soloSeparadores.test(linea)) {
      vacias.push(indice + 1);
      return;
    }

    const celdas = dividirLinea(linea, delimitador).map((celda) => celda.trim());

    if (esPrimeraFila) {
      esPrimeraFila = false;
      if (esEncabezado(celdas)) return;
    }

    const etiqueta = celdas[0] ?? '';
    const valor = (celdas[1] ?? '').trim();

    if (!etiqueta && !valor) {
      vacias.push(indice + 1);
      return;
    }

    filas.push({ linea: indice + 1, etiqueta, ...(valor ? { valor } : {}) });
  });

  return { filas, vacias };
}

function detectarDelimitador(linea: string): ',' | ';' {
  const puntoYComa = contarFueraDeComillas(linea, ';');
  const coma = contarFueraDeComillas(linea, ',');
  return puntoYComa > coma ? ';' : ',';
}

function contarFueraDeComillas(linea: string, caracter: string): number {
  let total = 0;
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const actual = linea[i];
    if (actual === '"') {
      if (entreComillas && linea[i + 1] === '"') i += 1;
      else entreComillas = !entreComillas;
    } else if (actual === caracter && !entreComillas) {
      total += 1;
    }
  }
  return total;
}

function esEncabezado(celdas: string[]): boolean {
  const primera = celdas[0]?.trim().toLowerCase() ?? '';
  return ENCABEZADOS.has(primera);
}

function dividirLinea(linea: string, delimitador: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];

    if (entreComillas) {
      if (caracter === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        actual += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === delimitador) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }

  celdas.push(actual);
  return celdas;
}
