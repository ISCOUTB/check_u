import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import {
  dentroDelPlazoCorreccion,
  fechaCorteCorreccion,
} from '../periodos/asignacion-periodo.js';
import { ConsultaPazYSalvoService } from './consulta-paz-y-salvo.service.js';
import { ESTADOS_FINALES, recalcularEstado } from './recalcular-estado.js';

const ADMITE_CORRECCION = [
  'EN_PROCESO',
  'POR_REVISAR',
  'NO_VALIDA',
  'INCONSISTENTE',
];

/**
 * Tarea 50: «Consultar de nuevo» el Paz y Salvo en Biblioteca. Para el estudiante equivale a un
 * reenvío (misma regla de estado, plazo, 3 por día e idempotencia); para la funcionaria no consume
 * intentos y solo agrega una consulta a la versión actual.
 */
@Injectable()
export class ReconsultaPazYSalvoService {
  constructor(
    private readonly db: DatabaseService,
    private readonly pazYSalvo: ConsultaPazYSalvoService,
  ) {}

  async porEstudiante(
    idEstudiante: number,
    idSolicitud: number,
    clave: string,
  ) {
    if (!/^[\w-]{8,128}$/.test(clave ?? ''))
      throw new BadRequestException('Envía una clave de consulta válida.');
    return this.db.transaction(async (client) => {
      const r = await client.query<{
        estado: string;
        fecha_fin: string | null;
      }>(
        `SELECT s.estado, p.fecha_fin::text AS fecha_fin
        FROM solicitud_grado s LEFT JOIN periodos_grado p ON p.id = s.id_periodo
        WHERE s.id_solicitud = $1 AND s.id_estudiante = $2 FOR UPDATE OF s`,
        [idSolicitud, idEstudiante],
      );
      const s = r.rows[0];
      if (!s) throw new NotFoundException('Preinscripción no disponible.');
      const previo = await client.query<{ id_entrega: number }>(
        'SELECT id_entrega FROM entregas WHERE id_solicitud = $1 AND clave_idempotencia = $2',
        [idSolicitud, clave],
      );
      if (previo.rows.length)
        return {
          ok: true,
          id_solicitud: idSolicitud,
          id_entrega: previo.rows[0].id_entrega,
          estado: s.estado,
        };
      if (!ADMITE_CORRECCION.includes(s.estado))
        throw new ConflictException(
          'La solicitud no admite correcciones en su estado actual.',
        );
      if (s.fecha_fin && !dentroDelPlazoCorreccion(s.fecha_fin))
        throw new ConflictException(
          `El plazo para corregir documentos terminó el ${fechaCorteCorreccion(s.fecha_fin)}.`,
        );
      const conteo = await client.query<{ usados: number }>(
        `SELECT COUNT(*)::int AS usados FROM entregas WHERE id_solicitud = $1 AND tipo_entrega = 'CORRECCION'
        AND fecha_entrega_bogota = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date`,
        [idSolicitud],
      );
      if (conteo.rows[0].usados >= 3)
        throw new ConflictException(
          'Alcanzaste los tres reenvíos de hoy. Puedes volver a enviar desde la medianoche de Bogotá.',
        );
      const actual = await this.actual(client, idSolicitud);
      if (actual.estado === 'VALIDO')
        throw new ForbiddenException(
          'No se permite reemplazar un documento válido.',
        );
      const entrega = await client.query<{ id_entrega: number }>(
        `INSERT INTO entregas (id_solicitud, numero_entrega, tipo_entrega, clave_idempotencia, huella_envio)
        SELECT $1, COALESCE(MAX(numero_entrega),0)+1, 'CORRECCION', $2, 'consulta-paz-y-salvo'
        FROM entregas WHERE id_solicitud = $1 RETURNING id_entrega`,
        [idSolicitud, clave],
      );
      const idEntrega = entrega.rows[0].id_entrega;
      await this.pazYSalvo.crearYConsultar(
        client,
        idSolicitud,
        idEntrega,
        actual.version + 1,
      );
      return {
        ok: true,
        id_solicitud: idSolicitud,
        id_entrega: idEntrega,
        estado: await recalcularEstado(client, idSolicitud),
      };
    });
  }

  async porFuncionaria(idSolicitud: number) {
    return this.db.transaction(async (client) => {
      const r = await client.query<{ estado: string }>(
        'SELECT estado FROM solicitud_grado WHERE id_solicitud = $1 FOR UPDATE',
        [idSolicitud],
      );
      const s = r.rows[0];
      if (!s) throw new NotFoundException('Solicitud no disponible.');
      if (s.estado === 'BORRADOR' || ESTADOS_FINALES.includes(s.estado))
        throw new ConflictException('La solicitud ya fue decidida.');
      const actual = await this.actual(client, idSolicitud);
      await this.pazYSalvo.consultar(client, actual.id_documento, idSolicitud);
      return {
        ok: true as const,
        estadoSolicitud: await recalcularEstado(client, idSolicitud),
      };
    });
  }

  /** Versión actual del Paz y Salvo de la solicitud enviada. */
  private async actual(client: PoolClient, idSolicitud: number) {
    const r = await client.query<{
      id_documento: number;
      version: number;
      estado: string;
    }>(
      `SELECT id_documento, version, estado FROM documentos
      WHERE id_solicitud = $1 AND tipo_documento = 'paz_y_salvo_bib' AND id_entrega IS NOT NULL
      ORDER BY version DESC LIMIT 1`,
      [idSolicitud],
    );
    if (!r.rows[0])
      throw new NotFoundException(
        'La solicitud no tiene consulta de Paz y Salvo.',
      );
    return r.rows[0];
  }
}
