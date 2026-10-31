import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { detalleAnalisis } from './detalle-analisis.js';

@Injectable()
export class CancelacionesService {
  constructor(private readonly db: DatabaseService) {}

  private validarId(id: number) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647)
      throw new BadRequestException(
        'Identificador de preinscripción inválido.',
      );
  }
  async cancelar(idEstudiante: number, idSolicitud: number) {
    this.validarId(idSolicitud);
    return this.db.transaction(async (client) => {
      // Guardar borrador bloquea primero el usuario: respetar ese orden antes de la solicitud.
      // KEY SHARE es compatible con las claves foráneas insertadas por un análisis en curso.
      await client.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario=$1 FOR KEY SHARE',
        [idEstudiante],
      );
      const r = await client.query(
        `SELECT estado FROM solicitud_grado
        WHERE id_solicitud=$1 AND id_estudiante=$2 FOR UPDATE`,
        [idSolicitud, idEstudiante],
      );
      const solicitud = r.rows[0];
      if (!solicitud)
        throw new NotFoundException('Preinscripción no disponible.');
      const repetida = solicitud.estado === 'CANCELADA';
      if (!repetida && solicitud.estado !== 'EN_PROCESO')
        throw new ConflictException({
          codigo: 'ESTADO_NO_CANCELABLE',
          message: 'Solo puedes cancelar una preinscripción en proceso.',
        });
      if (!repetida)
        await client.query(
          `UPDATE solicitud_grado SET estado='CANCELADA',
        fecha_actualizacion=CURRENT_TIMESTAMP WHERE id_solicitud=$1`,
          [idSolicitud],
        );
      const auditoria = await client.query(
        'SELECT fecha_cancelacion FROM cancelaciones_preinscripcion WHERE id_solicitud=$1',
        [idSolicitud],
      );
      return {
        ok: true,
        id: String(idSolicitud),
        estado: 'CANCELADA',
        yaCancelada: repetida,
        canceladaEn: auditoria.rows[0]?.fecha_cancelacion ?? null,
      };
    });
  }

  /** Contrato compartido con el listado de #106; jamás recibe otro estudiante desde el cliente. */
  async listar(idEstudiante: number) {
    const r = await this.db.query(
      `SELECT s.id_solicitud::text AS id,s.tipo_solicitud AS nivel,s.estado,
      s.estado NOT IN ('CANCELADA','CERRADA') AS activa,
      (SELECT MIN(e.fecha_entrega) FROM entregas e WHERE e.id_solicitud=s.id_solicitud AND e.tipo_entrega='INICIAL') AS "fechaSolicitud",
      s.fecha_creacion AS "fechaCreacion",c.fecha_cancelacion AS "canceladaEn",
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'nombre',p.nombre,
        'fechaInicio',p.fecha_inicio::text,'fechaFin',p.fecha_fin::text,'fechaCorte',(p.fecha_fin-7)::text) END AS periodo
      FROM solicitud_grado s LEFT JOIN periodos_grado p ON p.id=s.id_periodo
      LEFT JOIN cancelaciones_preinscripcion c ON c.id_solicitud=s.id_solicitud
      WHERE s.id_estudiante=$1 ORDER BY s.fecha_creacion DESC,s.id_solicitud DESC`,
      [idEstudiante],
    );
    return { solicitudes: r.rows };
  }

  detalle(idEstudiante: number, idSolicitud: number) {
    this.validarId(idSolicitud);
    return detalleAnalisis(this.db, idEstudiante, idSolicitud);
  }
}
