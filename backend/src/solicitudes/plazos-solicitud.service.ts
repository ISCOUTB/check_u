import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { recalcularEstado } from './recalcular-estado.js';

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
    for (const { id } of viejas.rows)
      await this.db.transaction((client) => recalcularEstado(client, id));
    const vencidas = await this.db.query<{ id: number }>(
      `SELECT s.id_solicitud AS id FROM solicitud_grado s JOIN periodos_grado p ON p.id = s.id_periodo
      WHERE s.estado IN ('NO_VALIDA', 'INCONSISTENTE')
        AND p.fecha_fin - 7 < COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)
      ORDER BY s.id_solicitud`,
      [hoy ?? null],
    );
    let anuladas = 0;
    for (const { id } of vencidas.rows) if (await this.anular(id)) anuladas++;
    return { recalculadas: viejas.rows.length, anuladas };
  }

  private anular(id: number): Promise<boolean> {
    return this.db.transaction(async (client) => {
      // Se vuelve a leer con bloqueo: un reenvío o una decisión pudieron cambiarla entre tanto.
      const r = await client.query<{ id_estudiante: number }>(
        `UPDATE solicitud_grado SET estado = 'CERRADA', fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_solicitud = $1 AND estado IN ('NO_VALIDA', 'INCONSISTENTE') RETURNING id_estudiante`,
        [id],
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
