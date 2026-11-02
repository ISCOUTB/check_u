import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
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
  // Verifica también que la migración de una instalación existente se puede repetir.
  await db.exec(
    await readFile(
      new URL(
        '../../../db/migrations/003-borrador-parcial.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../../db/init/02-userbase.sql', import.meta.url),
      'utf8',
    ),
  );
  // Tarea 42: la migración debe poder repetirse sobre el esquema ya actualizado.
  await db.exec(
    await readFile(
      new URL(
        '../../../db/migrations/009-estado-solicitud.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
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
