import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ArchivosTemporalesService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ArchivosTemporalesService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  private get raiz() {
    return resolve(
      process.env.DOCUMENTOS_TEMP_DIR || join(tmpdir(), 'checku-documentos'),
    );
  }

  constructor(private readonly databaseService: DatabaseService) {}

  onModuleInit() {
    // Se recupera desde PostgreSQL, no desde una cola en memoria; también después de reiniciar.
    void this.limpiar().catch(() =>
      this.logger.error(
        'No fue posible iniciar la limpieza documental; se reintentará.',
      ),
    );
    this.timer = setInterval(
      () => {
        void this.limpiar().catch(() =>
          this.logger.error('Error de limpieza documental; se reintentará.'),
        );
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private ruta(clave: string) {
    if (!/^[0-9a-f-]{36}\.pdf$/.test(clave))
      throw new Error('Ruta temporal no válida');
    return join(this.raiz, clave);
  }
  async guardar(buffer: Buffer) {
    await mkdir(this.raiz, { recursive: true, mode: 0o700 });
    const clave = `${randomUUID()}.pdf`;
    await writeFile(this.ruta(clave), buffer, { mode: 0o600, flag: 'wx' });
    return clave;
  }
  async eliminar(clave: string) {
    try {
      await unlink(this.ruta(clave));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  async limpiar() {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      // fecha_fin es el cierre de INSCRIPCIÓN; fecha_graduacion es la ceremonia.
      // Se conserva completo el día fecha_fin + 15, en America/Bogota.
      await this.databaseService.query(
        `
        UPDATE rutas r SET expira_en = ((p.fecha_fin + 16)::timestamp AT TIME ZONE 'America/Bogota')
        FROM documentos d JOIN solicitud_grado s ON s.id_solicitud = d.id_solicitud
        JOIN periodos_grado p ON p.id = s.id_periodo
        WHERE r.id_documento = d.id_documento AND r.activa = TRUE;
      `.trim(),
      );
      const rutas = await this.databaseService.query<{
        id_ruta: number;
        ruta_archivo: string;
      }>(
        'SELECT id_ruta, ruta_archivo FROM rutas WHERE activa = TRUE AND expira_en <= CURRENT_TIMESTAMP',
      );
      for (const ruta of rutas.rows) {
        try {
          await this.eliminar(ruta.ruta_archivo);
          await this.databaseService.query(
            `UPDATE rutas SET activa = FALSE, eliminado_en = CURRENT_TIMESTAMP,
            error_limpieza = NULL WHERE id_ruta = $1`,
            [ruta.id_ruta],
          );
        } catch {
          this.logger.error(
            `No se pudo eliminar el archivo temporal de ruta ${ruta.id_ruta}; se reintentará.`,
          );
          await this.databaseService.query(
            "UPDATE rutas SET error_limpieza = 'No fue posible eliminar el archivo; pendiente de reintento' WHERE id_ruta = $1",
            [ruta.id_ruta],
          );
        }
      }
      // Una caída entre escribir el archivo y confirmar SQL puede dejar huérfanos.
      const referencias = await this.databaseService.query<{
        ruta_archivo: string;
      }>('SELECT ruta_archivo FROM rutas');
      const conocidas = new Set(referencias.rows.map((r) => r.ruta_archivo));
      const entradas = await readdir(this.raiz).catch(
        (e: NodeJS.ErrnoException) => {
          if (e.code === 'ENOENT') return [];
          throw e;
        },
      );
      for (const clave of entradas) {
        if (!/^[0-9a-f-]{36}\.pdf$/.test(clave) || conocidas.has(clave))
          continue;
        const info = await stat(this.ruta(clave));
        if (Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000)
          await this.eliminar(clave);
      }
    } finally {
      this.ejecutando = false;
    }
  }
}
