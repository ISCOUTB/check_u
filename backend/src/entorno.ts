
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directorioActual = dirname(fileURLToPath(import.meta.url));
const archivo = resolve(directorioActual, '../.env');

if (existsSync(archivo)) {
  process.loadEnvFile(archivo);
}
