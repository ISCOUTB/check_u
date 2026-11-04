import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import {
  BibliotecaService,
  consultarConLimite,
  estadoDocumentoBiblioteca,
  type EstudianteBiblioteca,
} from '../biblioteca/biblioteca.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';

/**
 * Tarea 50: el Paz y Salvo de Biblioteca es un documento sin archivo (origen CONSULTA). Su estado
 * sale de la consulta a ALMA y queda en validaciones con el resultado completo, que muestran las
 * vistas del estudiante y de la funcionaria.
 */
@Injectable()
export class ConsultaPazYSalvoService {
  constructor(
    private readonly biblioteca: BibliotecaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** La identidad tal como está en CheckU, que el motor contrasta con ALMA. */
  async estudiante(
    client: PoolClient,
    idSolicitud: number,
  ): Promise<EstudianteBiblioteca> {
    const r = await client.query<{
      codigo: string | null;
      numero_documento: string | null;
      nombres: string | null;
      apellidos: string | null;
    }>(
      `SELECT u.codigo_estudiante AS codigo, p.numero_documento, u.nombres, u.apellidos
      FROM solicitud_grado s JOIN usuarios u ON u.id_usuario = s.id_estudiante
      LEFT JOIN perfil_estudiante p ON p.id_usuario = u.id_usuario WHERE s.id_solicitud = $1`,
      [idSolicitud],
    );
    const fila = r.rows[0];
    return {
      codigo: fila?.codigo ?? '',
      numeroDocumento: fila?.numero_documento ?? '',
      nombres: fila?.nombres ?? '',
      apellidos: fila?.apellidos ?? '',
    };
  }

  /** Crea la versión `version` del documento de Paz y Salvo en la entrega y la consulta. */
  async crearYConsultar(
    client: PoolClient,
    idSolicitud: number,
    idEntrega: number,
    version: number,
  ): Promise<string> {
    const doc = await client.query<{ id_documento: number }>(
      `INSERT INTO documentos (id_solicitud, id_entrega, tipo_documento, orden, version, estado, origen)
      VALUES ($1, $2, 'paz_y_salvo_bib', 1, $3, 'POR_VALIDAR', 'CONSULTA') RETURNING id_documento`,
      [idSolicitud, idEntrega, version],
    );
    return this.consultar(client, doc.rows[0].id_documento, idSolicitud);
  }

  /** Consulta ALMA para un documento existente y guarda el resultado; devuelve su estado. */
  async consultar(
    client: PoolClient,
    idDocumento: number,
    idSolicitud: number,
  ): Promise<string> {
    const resultado = await consultarConLimite(
      this.biblioteca,
      await this.estudiante(client, idSolicitud),
    );
    const estado = estadoDocumentoBiblioteca(resultado);
    await client.query(
      'UPDATE documentos SET estado = $2 WHERE id_documento = $1',
      [idDocumento, estado],
    );
    const historial = estado === 'POR_REVISAR' ? 'PENDIENTE' : estado;
    const v = await client.query<{ id_validacion: number }>(
      `INSERT INTO validaciones (id_documento, tipo_validacion, resultado, mensaje, detalle)
      VALUES ($1, 'REQUISITOS', $2, $3, $4::jsonb) RETURNING id_validacion`,
      [
        idDocumento,
        historial,
        resultado.mensaje,
        JSON.stringify({
          fuente: resultado.fuente,
          resultado,
          mensaje: resultado.mensaje,
        }),
      ],
    );
    await client.query(
      `INSERT INTO historial_validaciones (id_validacion, estado_anterior, estado_nuevo, observacion)
      VALUES ($1, NULL, $2, $3)`,
      [
        v.rows[0].id_validacion,
        historial,
        'Consulta de Paz y Salvo en Biblioteca (ALMA).',
      ],
    );
    await this.notificaciones.porDocumento(client, v.rows[0].id_validacion);
    return estado;
  }
}
