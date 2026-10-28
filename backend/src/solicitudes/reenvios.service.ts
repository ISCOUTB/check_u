import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import {
  AnalisisPreinscripcionService,
  validarArchivos,
  type PdfPreinscripcion,
} from './analisis-preinscripcion.service.js';
import { ArchivosTemporalesService } from './archivos-temporales.service.js';
import type { InformarAvance } from './progreso-envio.js';

export type ArchivoCorreccion = Omit<PdfPreinscripcion, 'tipo'> & {
  id: number;
};
@Injectable()
export class ReenviosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly analisis: AnalisisPreinscripcionService,
    private readonly temporales: ArchivosTemporalesService,
  ) {}

  async original(idEstudiante: number, idDocumento: number) {
    const r = await this.db.query(
      `SELECT d.nombre_original, r.ruta_archivo, r.activa,
      ((p.fecha_fin + 16)::timestamp AT TIME ZONE 'America/Bogota') > CURRENT_TIMESTAMP AS vigente
      FROM documentos d JOIN solicitud_grado s ON s.id_solicitud = d.id_solicitud
      JOIN periodos_grado p ON p.id = s.id_periodo JOIN rutas r ON r.id_documento = d.id_documento
      WHERE s.id_estudiante = $1 AND d.id_documento = $2 ORDER BY r.id_ruta DESC LIMIT 1`,
      [idEstudiante, idDocumento],
    );
    const archivo = r.rows[0];
    if (!archivo) throw new NotFoundException('Documento no disponible.');
    if (!archivo.activa || !archivo.vigente)
      throw new GoneException(
        'El plazo de conservación del archivo original terminó. Los resultados del análisis se conservan.',
      );
    try {
      return {
        nombre: archivo.nombre_original as string,
        bytes: await this.temporales.leer(archivo.ruta_archivo as string),
      };
    } catch {
      throw new GoneException(
        'El archivo original ya no está disponible. Los resultados del análisis se conservan.',
      );
    }
  }

  async reenviar(
    idEstudiante: number,
    idSolicitud: number,
    clave: string,
    archivos: ArchivoCorreccion[],
    informar: InformarAvance = () => {},
  ) {
    if (
      !/^[\w-]{8,128}$/.test(clave ?? '') ||
      !archivos.length ||
      archivos.length > 6 ||
      archivos.some((a) => !Number.isSafeInteger(a.id) || a.id <= 0) ||
      new Set(archivos.map((a) => a.id)).size !== archivos.length
    )
      throw new BadRequestException(
        'Selecciona los documentos y una clave de envío válida.',
      );
    const huella = createHash('sha256')
      .update(
        JSON.stringify(
          archivos
            .map((a) => ({
              id: a.id,
              hash: createHash('sha256').update(a.buffer).digest('hex'),
            }))
            .sort((a, b) => a.id - b.id),
        ),
      )
      .digest('hex');
    const creados: string[] = [];
    try {
      return await this.db.transaction(async (client) => {
        const r = await client.query(
          `SELECT id_solicitud, tipo_solicitud, estado FROM solicitud_grado
          WHERE id_solicitud = $1 AND id_estudiante = $2 FOR UPDATE`,
          [idSolicitud, idEstudiante],
        );
        const s = r.rows[0];
        if (!s) throw new NotFoundException('Preinscripción no disponible.');
        const previo = await client.query(
          'SELECT id_entrega, huella_envio FROM entregas WHERE id_solicitud = $1 AND clave_idempotencia = $2',
          [idSolicitud, clave],
        );
        if (previo.rows.length) {
          if (previo.rows[0].huella_envio !== huella)
            throw new ConflictException(
              'La clave de envío ya se utilizó con otros documentos.',
            );
          return {
            ok: true,
            id_solicitud: idSolicitud,
            id_entrega: previo.rows[0].id_entrega,
            mensaje:
              'Esta corrección ya fue registrada. Consulta sus resultados.',
          };
        }
        if (
          !['EN_PROCESO', 'POR_REVISAR', 'NO_VALIDA', 'INCONSISTENTE'].includes(
            s.estado,
          )
        )
          throw new ConflictException(
            'La solicitud no admite correcciones en su estado actual.',
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
        const actuales = await client.query(
          `SELECT DISTINCT ON (tipo_documento, orden) * FROM documentos
          WHERE id_solicitud = $1 AND id_entrega IS NOT NULL ORDER BY tipo_documento, orden, version DESC`,
          [idSolicitud],
        );
        const elegidos = archivos.map((a) => {
          const d = actuales.rows.find((d) => d.id_documento === a.id);
          if (!d)
            throw new ConflictException(
              'Un documento ya tiene una versión más reciente. Recarga la página.',
            );
          if (d.estado === 'VALIDO')
            throw new ForbiddenException(
              'No se permite reemplazar un documento válido.',
            );
          return {
            documento: d,
            archivo: {
              ...a,
              tipo: d.tipo_documento + (d.orden === 2 ? '-2' : ''),
            },
          };
        });
        informar('Subiendo documentos.');
        validarArchivos(elegidos.map((e) => e.archivo));
        informar('Documentos cargados.');
        informar('Registrando corrección de preinscripción.');
        const entrega = await client.query(
          `INSERT INTO entregas (id_solicitud, numero_entrega, tipo_entrega, clave_idempotencia, huella_envio)
          SELECT $1, COALESCE(MAX(numero_entrega),0)+1, 'CORRECCION', $2, $3 FROM entregas WHERE id_solicitud=$1 RETURNING id_entrega`,
          [idSolicitud, clave, huella],
        );
        const idEntrega = entrega.rows[0].id_entrega as number;
        for (const { documento: d, archivo: a } of elegidos)
          await client.query(
            `INSERT INTO documentos
          (id_solicitud,id_entrega,tipo_documento,orden,nombre_original,mime_type,tamano_bytes,version,estado)
          VALUES ($1,$2,$3,$4,$5,'application/pdf',$6,$7,'POR_VALIDAR')`,
            [
              idSolicitud,
              idEntrega,
              d.tipo_documento,
              d.orden,
              a.originalname,
              a.buffer.length,
              d.version + 1,
            ],
          );
        // Estas escrituras siguen pendientes del COMMIT: no anunciar «almacenada» antes de confirmarlo.
        informar('Preparando documentos de la corrección.');
        informar('Enviando documentos al motor de análisis documental.');
        await this.analisis.procesar(
          client,
          idSolicitud,
          idEntrega,
          idEstudiante,
          s.tipo_solicitud as string,
          elegidos.map((e) => e.archivo),
          creados,
          informar,
        );
        await client.query(
          "UPDATE solicitud_grado SET estado='EN_PROCESO' WHERE id_solicitud=$1",
          [idSolicitud],
        );
        return {
          ok: true,
          id_solicitud: idSolicitud,
          id_entrega: idEntrega,
          mensaje:
            'Corrección registrada. Consulta los resultados actualizados.',
        };
      });
    } catch (error) {
      await this.analisis.descartar(creados);
      throw error;
    }
  }
}
