import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { calcularEstadoActual, recalcularEstado } from './recalcular-estado.js';

const MENSAJE_ANULACION =
  'El plazo para corregir terminó y tu solicitud tenía documentos sin corregir. Puedes inscribirte en un nuevo periodo.';

/**
 * Tarea 42a. Cada 15 minutos (y al arrancar):
 * - recalcula las solicitudes que quedaron en EN_PROCESO antes de que existiera el estado calculado;
 * - anula las NO_VALIDA e INCONSISTENTE cuyo plazo de corrección (fecha_fin − 7) ya terminó.
 * Las POR_REVISAR y VALIDA no se anulan: esperan la decisión de la funcionaria.
 */
@Injectable()
export class PlazosSolicitudService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlazosSolicitudService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  constructor(
    private readonly db: DatabaseService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** `hoy` (YYYY-MM-DD) solo para pruebas; por defecto, la fecha de Bogotá. */
  async ejecutar(
    hoy?: string,
  ): Promise<{ recalculadas: number; anuladas: number }> {
    const viejas = await this.db.query<{ id: number }>(
      "SELECT id_solicitud AS id FROM solicitud_grado WHERE estado = 'EN_PROCESO' ORDER BY id_solicitud",
    );
    let recalculadas = 0;
    for (const { id } of viejas.rows)
      if (
        await this.porSolicitud(id, () =>
          this.db.transaction((client) => recalcularEstado(client, id)),
        )
      )
        recalculadas++;
    // Solo las que tenían ese estado desde antes del vencimiento (fecha_actualizacion): una solicitud
    // vieja recalculada después del cierre, o resuelta por la funcionaria, la decide la funcionaria.
    const vencidas = await this.db.query<{ id: number }>(
      `SELECT s.id_solicitud AS id FROM solicitud_grado s JOIN periodos_grado p ON p.id = s.id_periodo
      WHERE s.estado IN ('NO_VALIDA', 'INCONSISTENTE', 'POR_REVISAR')
        AND p.fecha_fin - 7 < COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)
        AND s.fecha_actualizacion < ((p.fecha_fin - 6)::timestamp AT TIME ZONE 'America/Bogota')
      ORDER BY s.id_solicitud`,
      [hoy ?? null],
    );
    let anuladas = 0;
    for (const { id } of vencidas.rows)
      if (await this.porSolicitud(id, () => this.anular(id))) anuladas++;
    return { recalculadas, anuladas };
  }

  /** Una solicitud que falla no detiene la pasada: se registra y se reintenta en la siguiente. */
  private async porSolicitud(
    id: number,
    accion: () => Promise<unknown>,
  ): Promise<boolean> {
    try {
      return (await accion()) !== false;
    } catch {
      this.logger.error(
        `No fue posible revisar el plazo de la solicitud ${id}; se reintentará.`,
      );
      return false;
    }
  }

  private anular(id: number): Promise<boolean> {
    return this.db.transaction(async (client) => {
      // Se vuelve a leer con bloqueo: un reenvío o una decisión pudieron cambiarla entre tanto.
      const s = await client.query<{ estado: string }>(
        'SELECT estado FROM solicitud_grado WHERE id_solicitud = $1 FOR UPDATE',
        [id],
      );
      const actual = s.rows[0]?.estado;
      // Una corrección pedida deja POR_REVISAR: cuenta lo que dicen sus documentos.
      const efectivo =
        actual === 'POR_REVISAR'
          ? await calcularEstadoActual(client, id)
          : actual;
      if (efectivo !== 'NO_VALIDA' && efectivo !== 'INCONSISTENTE')
        return false;
      const r = await client.query<{ id_estudiante: number }>(
        `UPDATE solicitud_grado SET estado = 'CERRADA', fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_solicitud = $1 AND estado = $2 RETURNING id_estudiante`,
        [id, actual],
      );
      if (!r.rows.length) return false;
      await this.notificaciones.crear(client, {
        estudianteId: r.rows[0].id_estudiante,
        tipo: 'error',
        titulo: 'Solicitud anulada',
        msg: MENSAJE_ANULACION,
        generadoPor: 'system',
        clave: `anulacion:${id}`,
        solicitudId: id,
      });
      return true;
    });
  }

  async barrer() {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      await this.ejecutar();
    } catch {
      this.logger.error(
        'No fue posible revisar los plazos de las solicitudes; se reintentará.',
      );
    } finally {
      this.ejecutando = false;
    }
  }

  async onModuleInit() {
    await this.barrer();
    this.timer = setInterval(
      () => {
        void this.barrer();
      },
      15 * 60 * 1000,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
