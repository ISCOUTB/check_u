import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { detalleAnalisis } from '../solicitudes/detalle-analisis.js';
import { observacionesDocumento } from '../solicitudes/observaciones-documento.js';

export type TipoNotificacion = 'success' | 'warning' | 'error' | 'info';
export type ActorNotificacion = 'system' | 'motor' | 'funcionario';
export interface NuevaNotificacion {
  estudianteId: number;
  tipo: TipoNotificacion;
  titulo: string;
  msg: string;
  generadoPor: ActorNotificacion;
  clave: string;
  solicitudId?: number;
  documentoId?: number;
  revisionId?: number;
}
export interface AccionRevision {
  accion?: unknown;
  comentario?: unknown;
  documentos?: unknown;
}
const CAMPOS = `id::text AS id,tipo,titulo,msg,generado_por,leida,
  (creado_en AT TIME ZONE 'America/Bogota')::date::text AS fecha,
  to_char(creado_en AT TIME ZONE 'America/Bogota','HH24:MI:SS') AS hora,
  to_char(creado_en AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "creadoEn"`;

@Injectable()
export class NotificacionesService {
  constructor(private readonly db: DatabaseService) {}

  async solicitudesFuncionaria() {
    const r = await this.db.query(`SELECT s.id_solicitud::text AS id,s.id_periodo AS "periodId",
      s.tipo_solicitud AS nivel,s.estado, s.fecha_creacion AS "fechaRegistro",
      u.nombres||' '||u.apellidos AS estudiante
      FROM solicitud_grado s JOIN usuarios u ON u.id_usuario=s.id_estudiante
      ORDER BY s.fecha_creacion DESC,s.id_solicitud DESC`);
    return r.rows;
  }

  async detalleFuncionaria(id: number) {
    const r = await this.db.query('SELECT id_estudiante FROM solicitud_grado WHERE id_solicitud=$1', [id]);
    if (!r.rows.length) throw new NotFoundException('Solicitud no disponible.');
    const detalle = await detalleAnalisis(this.db, r.rows[0].id_estudiante, id);
    const revisiones = await this.db.query(`SELECT r.id_revision::text AS id,r.resultado,r.comentario,
      r.documentos_ids AS documentos,r.fecha_revision AS fecha,u.nombres||' '||u.apellidos AS funcionario
      FROM revisiones r JOIN usuarios u ON u.id_usuario=r.id_funcionario
      WHERE r.id_solicitud=$1 ORDER BY r.fecha_revision DESC,r.id_revision DESC`, [id]);
    return {...detalle, revisiones: revisiones.rows};
  }

  async crear(client: PoolClient, n: NuevaNotificacion) {
    const r = await client.query<{ id: string }>(
      `SELECT crear_notificacion($1,$2,$3,$4,$5,$6,$7,$8,$9)::text AS id`,
      [
        n.estudianteId,
        n.tipo,
        n.titulo,
        n.msg,
        n.generadoPor,
        n.clave,
        n.solicitudId ?? null,
        n.documentoId ?? null,
        n.revisionId ?? null,
      ],
    );
    return r.rows[0].id;
  }

  /** La entrega y su notificación se confirman o revierten juntas. Una notificación por documento/version. */
  async porDocumento(client: PoolClient, idValidacion: number) {
    const r = await client.query(
      `SELECT d.*,s.id_estudiante,v.detalle,
      nombre_documento_notificacion(d.tipo_documento,d.orden) AS nombre
      FROM validaciones v JOIN documentos d ON d.id_documento=v.id_documento
      JOIN solicitud_grado s ON s.id_solicitud=d.id_solicitud WHERE v.id_validacion=$1`,
      [idValidacion],
    );
    const d = r.rows[0];
    if (!d) throw new NotFoundException('Validación no disponible.');
    const estados: Record<string, { titulo: string; tipo: TipoNotificacion }> =
      {
        VALIDO: { titulo: 'Válido', tipo: 'success' },
        NO_VALIDO: { titulo: 'No válido', tipo: 'error' },
        INCONSISTENTE: { titulo: 'Inconsistente', tipo: 'warning' },
        POR_REVISAR: { titulo: 'Por revisar', tipo: 'info' },
      };
    const estado = estados[d.estado] ?? estados.POR_REVISAR;
    const motivos = [
      ...new Set(
        observacionesDocumento(d.estado, d.detalle).map((o) => o.mensaje),
      ),
    ].join(' ');
    return this.crear(client, {
      estudianteId: d.id_estudiante,
      tipo: estado.tipo,
      titulo: estado.titulo,
      msg: `${d.nombre} · Versión ${d.version}: ${motivos}`,
      generadoPor:
        d.detalle?.estado_procesamiento === 'pendiente_integracion'
          ? 'system'
          : 'motor',
      clave: `validacion:${idValidacion}`,
      solicitudId: d.id_solicitud,
      documentoId: d.id_documento,
    });
  }

  /** Cada solicitud recibe como máximo un aviso por fecha institucional, incluso con varios procesos. */
  async generarRecordatorios(estudianteId?: number, fecha?: string) {
    await this.db.query(
      `WITH calendario AS (
      SELECT COALESCE($2::date,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date) AS hoy
    ) SELECT crear_notificacion(s.id_estudiante,'warning','Plazo por vencer',
      'Te queda poco tiempo para presentar toda la documentación ('||(p.fecha_fin-c.hoy)||CASE WHEN p.fecha_fin-c.hoy=1 THEN ' día).' ELSE ' días).' END,
      'system','plazo:'||s.id_solicitud||':'||c.hoy,s.id_solicitud)
      FROM solicitud_grado s JOIN periodos_grado p ON p.id=s.id_periodo CROSS JOIN calendario c
      WHERE ($1::integer IS NULL OR s.id_estudiante=$1) AND p.estado='ABIERTO'
      AND p.fecha_inicio<=c.hoy AND p.fecha_fin-c.hoy BETWEEN 0 AND 15
      AND s.estado IN ('BORRADOR','EN_PROCESO','POR_REVISAR','NO_VALIDA','INCONSISTENTE')`,
      [estudianteId ?? null, fecha ?? null],
    );
  }

  async listar(estudianteId: number) {
    await this.generarRecordatorios(estudianteId);
    const r = await this.db.query(
      `SELECT ${CAMPOS} FROM notificaciones WHERE estudiante_id=$1 ORDER BY creado_en DESC,id DESC`,
      [estudianteId],
    );
    return {
      notificaciones: r.rows,
      noLeidas: r.rows.filter((n) => !n.leida).length,
    };
  }

  async marcarLeida(estudianteId: number, id: string) {
    if (!/^\d{1,19}$/.test(id) || BigInt(id) > 9223372036854775807n)
      throw new BadRequestException('Identificador inválido.');
    const r = await this.db.query(
      `UPDATE notificaciones SET leida=TRUE WHERE id=$1 AND estudiante_id=$2 RETURNING id::text AS id`,
      [id, estudianteId],
    );
    if (!r.rows.length)
      throw new NotFoundException('Notificación no disponible.');
    return { id: r.rows[0].id, leida: true };
  }

  /** Persistencia mínima de las acciones manuales; el trigger central produce su aviso. */
  async registrarRevision(
    funcionarioId: number,
    solicitudId: number,
    body: AccionRevision,
  ) {
    const acciones: Record<string, string> = {
      aceptada: 'APROBADA',
      recarga: 'CORRECCION_REQUERIDA',
      comentario: 'POR_REVISAR',
      anulada: 'RECHAZADA',
    };
    const accion = typeof body?.accion === 'string' ? body.accion : '';
    if (
      !Object.hasOwn(acciones, accion) ||
      (body.comentario !== undefined && typeof body.comentario !== 'string')
    )
      throw new BadRequestException('Acción de revisión inválida.');
    const comentario =
      typeof body.comentario === 'string' ? body.comentario.trim() : '';
    if (comentario.length > 5000 || (accion === 'comentario' && !comentario))
      throw new BadRequestException(
        'Escribe un comentario de hasta 5000 caracteres.',
      );
    const ids = body.documentos;
    if (
      accion === 'recarga' &&
      (!Array.isArray(ids) ||
        !ids.length ||
        ids.length > 7 ||
        ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(ids).size !== ids.length)
    )
      throw new BadRequestException(
        'Selecciona los documentos de la corrección.',
      );
    return this.db.transaction(async (client) => {
      const r = await client.query(
        'SELECT estado FROM solicitud_grado WHERE id_solicitud=$1 FOR UPDATE',
        [solicitudId],
      );
      if (!r.rows.length)
        throw new NotFoundException('Solicitud no disponible.');
      if (
        accion !== 'comentario' &&
        ['BORRADOR', 'VALIDA', 'CERRADA'].includes(r.rows[0].estado)
      )
        throw new ConflictException(
          'La solicitud no admite esa revisión en su estado actual.',
        );
      if (accion === 'recarga') {
        const docs = await client.query(
          `SELECT id_documento,estado FROM (SELECT DISTINCT ON (tipo_documento,orden) id_documento,estado
          FROM documentos WHERE id_solicitud=$1 AND id_entrega IS NOT NULL ORDER BY tipo_documento,orden,version DESC) d WHERE id_documento=ANY($2::integer[])`,
          [solicitudId, ids],
        );
        if (
          docs.rows.length !== (ids as number[]).length ||
          docs.rows.some((d) => d.estado === 'VALIDO')
        )
          throw new BadRequestException(
            'Selecciona versiones actuales de documentos que requieran corrección.',
          );
      }
      const revision = await client.query(
        `INSERT INTO revisiones(id_solicitud,id_funcionario,resultado,comentario,documentos_ids)
        VALUES($1,$2,$3,$4,$5) RETURNING id_revision`,
        [
          solicitudId,
          funcionarioId,
          acciones[accion],
          comentario || null,
          accion === 'recarga' ? ids : null,
        ],
      );
      const estado = {
        aceptada: 'VALIDA',
        anulada: 'CERRADA',
        recarga: 'POR_REVISAR',
      }[accion];
      if (estado)
        await client.query(
          'UPDATE solicitud_grado SET estado=$2,fecha_actualizacion=CURRENT_TIMESTAMP WHERE id_solicitud=$1',
          [solicitudId, estado],
        );
      return { ok: true, idRevision: revision.rows[0].id_revision };
    });
  }
}
