import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ESTADOS_FINALES, recalcularEstado } from './recalcular-estado.js';

export interface CuerpoResolucion {
  resultado?: unknown;
  comentario?: unknown;
}
const RESULTADOS = ['VALIDO', 'NO_VALIDO'] as const;
const MENSAJES: Record<(typeof RESULTADOS)[number], string> = {
  VALIDO: 'Revisado por la funcionaria.',
  NO_VALIDO: 'Marcado como no válido por la funcionaria.',
};

/**
 * Tarea 42a: la funcionaria resuelve un documento «Por revisar» (p. ej. Paz y Salvo sin respuesta
 * de Biblioteca). Queda en validaciones e historial, en revisiones (que genera el aviso) y la
 * solicitud se recalcula, todo en la misma transacción.
 */
@Injectable()
export class ResolucionesService {
  constructor(private readonly db: DatabaseService) {}

  async resolver(
    idFuncionario: number,
    idDocumento: number,
    body: CuerpoResolucion,
  ): Promise<{ ok: true; estadoSolicitud: string }> {
    const resultado = body?.resultado;
    if (
      typeof resultado !== 'string' ||
      !(RESULTADOS as readonly string[]).includes(resultado) ||
      (body.comentario !== undefined && typeof body.comentario !== 'string')
    )
      throw new BadRequestException('Resolución inválida.');
    const comentario =
      typeof body.comentario === 'string' ? body.comentario.trim() : '';
    if (comentario.length > 5000)
      throw new BadRequestException(
        'El comentario admite hasta 5000 caracteres.',
      );
    if (resultado === 'NO_VALIDO' && !comentario)
      throw new BadRequestException(
        'Escribe el motivo por el que el documento no es válido.',
      );
    const estado = resultado as (typeof RESULTADOS)[number];
    return this.db.transaction(async (client) => {
      const doc = await client.query<{ id_solicitud: number }>(
        'SELECT id_solicitud FROM documentos WHERE id_documento=$1 AND id_entrega IS NOT NULL',
        [idDocumento],
      );
      if (!doc.rows.length)
        throw new NotFoundException('Documento no disponible.');
      const idSolicitud = doc.rows[0].id_solicitud;
      // Bloquea la solicitud: un reenvío simultáneo no puede cambiar la versión actual a mitad de camino.
      const s = await client.query<{ estado: string }>(
        'SELECT estado FROM solicitud_grado WHERE id_solicitud=$1 FOR UPDATE',
        [idSolicitud],
      );
      if (ESTADOS_FINALES.includes(s.rows[0].estado))
        throw new ConflictException('La solicitud ya fue decidida.');
      const actual = await client.query<{
        id_documento: number;
        estado: string;
      }>(
        `SELECT DISTINCT ON (d.tipo_documento, d.orden) d.id_documento, d.estado
        FROM documentos d JOIN documentos e ON e.id_solicitud=d.id_solicitud
          AND e.tipo_documento=d.tipo_documento AND e.orden=d.orden
        WHERE e.id_documento=$1 AND d.id_entrega IS NOT NULL
        ORDER BY d.tipo_documento, d.orden, d.version DESC`,
        [idDocumento],
      );
      const vigente = actual.rows[0];
      if (
        vigente?.id_documento !== idDocumento ||
        vigente.estado !== 'POR_REVISAR'
      )
        throw new ConflictException(
          'El documento ya no está por revisar o no es la versión actual.',
        );
      const funcionario = await client.query<{ nombre: string }>(
        "SELECT nombres||' '||apellidos AS nombre FROM usuarios WHERE id_usuario=$1",
        [idFuncionario],
      );
      await client.query(
        'UPDATE documentos SET estado=$2 WHERE id_documento=$1',
        [idDocumento, estado],
      );
      const v = await client.query<{ id_validacion: number }>(
        `INSERT INTO validaciones (id_documento, tipo_validacion, resultado, mensaje, detalle)
        VALUES ($1, 'MANUAL', $2, $3, $4::jsonb) RETURNING id_validacion`,
        [
          idDocumento,
          estado,
          MENSAJES[estado],
          JSON.stringify({
            fuente: 'revision_manual',
            funcionario: funcionario.rows[0]?.nombre ?? null,
            comentario: comentario || null,
            mensaje: MENSAJES[estado],
          }),
        ],
      );
      await client.query(
        `INSERT INTO historial_validaciones (id_validacion, estado_anterior, estado_nuevo, observacion)
        VALUES ($1, 'PENDIENTE', $2, $3)`,
        [v.rows[0].id_validacion, estado, comentario || MENSAJES[estado]],
      );
      await client.query(
        `INSERT INTO revisiones(id_solicitud,id_funcionario,resultado,comentario,documentos_ids)
        VALUES($1,$2,'DOCUMENTO_RESUELTO',$3,$4)`,
        [idSolicitud, idFuncionario, comentario || null, [idDocumento]],
      );
      return {
        ok: true as const,
        estadoSolicitud: await recalcularEstado(client, idSolicitud),
      };
    });
  }
}
