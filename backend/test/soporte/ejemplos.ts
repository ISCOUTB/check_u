import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ejemplos compartidos de los contratos, en contratos/ejemplos/ de la raíz del repo.
// Los usan las pruebas de Zod y la prueba de paridad con los JSON Schema (ajv).
export const CARPETA_EJEMPLOS = fileURLToPath(new URL('../../../contratos/ejemplos/', import.meta.url));

export type Ejemplo = { archivo: string; datos: unknown };

function leerCarpeta(carpeta: string): Ejemplo[] {
  return readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.json'))
    .sort()
    .map((archivo) => ({
      archivo,
      datos: JSON.parse(readFileSync(join(carpeta, archivo), 'utf8')) as unknown,
    }));
}

/** Ejemplos válidos e inválidos de un esquema (carpeta contratos/ejemplos/<esquema>/). */
export function cargarEjemplos(esquema: string): { validos: Ejemplo[]; invalidos: Ejemplo[] } {
  return {
    validos: leerCarpeta(join(CARPETA_EJEMPLOS, esquema, 'validos')),
    invalidos: leerCarpeta(join(CARPETA_EJEMPLOS, esquema, 'invalidos')),
  };
}
