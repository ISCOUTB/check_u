import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';

/** PostgreSQL embebido: ejecuta el SQL y los triggers reales, sin Docker para las pruebas. */
export async function crearDbBorrador() {
  const db = await PGlite.create();
  await db.exec(
    await readFile(
      new URL('../../../db/init/01-schema.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../../db/init/02-userbase.sql', import.meta.url),
      'utf8',
    ),
  );
  // Igual que levantar.ps1: después del esquema base, las migraciones de db/migrations en orden
  // alfabético. Las que ya están incluidas en 01-schema.sql deben poder repetirse.
  const migraciones = new URL('../../../db/migrations/', import.meta.url);
  for (const archivo of (await readdir(migraciones))
    .filter((n) => n.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(new URL(archivo, migraciones), 'utf8'));
  // pg entrega DATE como Date según la configuración; para la API usamos fecha calendario.
  const query = (sql: string, params?: unknown[]) => db.query(sql, params);
  const servicio = {
    query,
    async transaction<T>(cb: (client: PoolClient) => Promise<T>) {
      await db.exec('BEGIN');
      try {
        const result = await cb({ query } as unknown as PoolClient);
        await db.exec('COMMIT');
        return result;
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, servicio };
}
