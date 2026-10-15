import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generarEsquemas } from './exportar.js';

// Escribe contratos/esquemas/ en la raíz del repo. Se corre con `npm run contratos:exportar`
// desde backend/, cada vez que cambia un contrato de Zod.
const carpeta = resolve(process.cwd(), '..', 'contratos', 'esquemas');
const archivos = generarEsquemas();

mkdirSync(carpeta, { recursive: true });

// Quita exportaciones de esquemas que ya no existen en Zod.
for (const existente of readdirSync(carpeta)) {
  if (!(existente in archivos)) rmSync(join(carpeta, existente));
}

for (const [nombre, contenido] of Object.entries(archivos)) {
  writeFileSync(join(carpeta, nombre), `${JSON.stringify(contenido, null, 2)}\n`, 'utf8');
}

console.log(`Contratos exportados: ${Object.keys(archivos).length} archivos en ${carpeta}`);
