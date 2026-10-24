import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  RespuestaSolicitudEstudiante,
  SolicitudResumen,
} from './solicitudes.types.js';

@Injectable()
export class SolicitudesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async obtenerSolicitudEstudiante(
    idEstudiante: number,
  ): Promise<RespuestaSolicitudEstudiante> {
    const consulta = `
      SELECT id_solicitud, tipo_solicitud, estado
      FROM solicitud_grado
      WHERE id_estudiante = $1
      ORDER BY id_solicitud DESC
      LIMIT 1;
    `;

    const resultado = await this.databaseService.query<SolicitudResumen>(
      consulta,
      [idEstudiante],
    );

    if (resultado.rows.length === 0) {
      return {
        tiene_solicitud: false,
        solicitud: null,
      };
    }

    const fila = resultado.rows[0];
    return {
      tiene_solicitud: true,
      solicitud: {
        id_solicitud: fila.id_solicitud,
        tipo_solicitud: fila.tipo_solicitud,
        estado: fila.estado,
      },
    };
  }
}
