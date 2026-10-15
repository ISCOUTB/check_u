import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carga backend/.env si existe (los comandos npm corren desde backend/). Sin archivo no cambia nada:
// se usan las variables del sistema. Las variables ya definidas no se reemplazan.
// main.ts lo importa primero para que AppModule ya vea estas variables.
const archivo = resolve(process.cwd(), '.env');

if (existsSync(archivo)) {
  process.loadEnvFile(archivo);
}
