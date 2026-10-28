import { etapaDocumento, type InformarAvance } from './progreso-envio.js';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { detalleAnalisis } from './detalle-analisis.js';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DocumentosService } from '../documentos/documentos.service.js';
import { DocumentValidationResult } from '../contratos/resultado-documento.js';
import { ArchivosTemporalesService } from './archivos-temporales.service.js';

export interface PdfPreinscripcion {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  tipo: string;
}
const TIPOS = [
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
];

export function validarArchivos(archivos: PdfPreinscripcion[]) {
  if (!archivos.length || archivos.length > 6)
    throw new BadRequestException(
      'Adjunta nuevamente los PDF requeridos para enviar la preinscripción.',
    );
  const claves = new Set<string>();
  let total = 0;
  for (const a of archivos) {
    const tipo = a.tipo?.replace(/-2$/, '');
    if (
      !TIPOS.includes(tipo) ||
      (a.tipo.endsWith('-2') && tipo !== 'estampilla_pro_cultura') ||
      claves.has(a.tipo)
    )
      throw new BadRequestException(
        'Tipos documentales inválidos o repetidos.',
      );
    claves.add(a.tipo);
    total += a.buffer.length;
    if (
      a.mimetype !== 'application/pdf' ||
      a.buffer.length === 0 ||
      a.buffer.length > 25 * 1024 * 1024 ||
      a.buffer.subarray(0, 5).toString() !== '%PDF-' ||
      a.originalname.length > 255
    )
      throw new BadRequestException(
        'Los documentos deben ser PDF válidos de hasta 25 MB.',
      );
  }
  // El motor admite 25 MB por solicitud; cada PDF se transmite individualmente.
  if (total > 50 * 1024 * 1024)
    throw new BadRequestException('El conjunto de PDF no puede superar 50 MB.');
}

@Injectable()
export class AnalisisPreinscripcionService {
  constructor(
    private readonly motor: DocumentosService,
    private readonly temporales: ArchivosTemporalesService,
    private readonly db: DatabaseService,
  ) {}

  obtenerDetalle(idEstudiante: number) {
    return detalleAnalisis(this.db, idEstudiante);
  }

  async procesar(
    client: PoolClient,
    idSolicitud: number,
    idEntrega: number,
    idEstudiante: number,
    nivel: string,
    archivos: PdfPreinscripcion[],
    creados: string[],
    informar: InformarAvance = () => {},
  ) {
    validarArchivos(archivos);
    const docs = await client.query<{
      id_documento: number;
      tipo_documento: string;
      orden: number;
      version: number;
    }>(
      'SELECT id_documento, tipo_documento, orden, version FROM documentos WHERE id_solicitud = $1 AND id_entrega = $2 ORDER BY id_documento',
      [idSolicitud, idEntrega],
    );
    const ids = docs.rows.map(
      (d) => d.tipo_documento + (d.orden === 2 ? '-2' : ''),
    );
    if (
      ids.length !== archivos.length ||
      ids.some((id) => !archivos.some((a) => a.tipo === id))
    )
      throw new BadRequestException(
        'Debes adjuntar un PDF por cada documento de la preinscripción.',
      );
    const alumno = await client.query(
      `SELECT u.codigo_estudiante, u.nombres, u.apellidos, p.numero_documento
      FROM usuarios u JOIN perfil_estudiante p ON p.id_usuario = u.id_usuario WHERE u.id_usuario = $1`,
      [idEstudiante],
    );
    const u = alumno.rows[0];
    const estudiante = {
      id_student: u.codigo_estudiante,
      nivel,
      first_name: u.nombres,
      last_name: u.apellidos,
      identification_number: u.numero_documento,
    };
    const prioridad = [
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'saber_pro',
      'estampilla_pro_cultura',
    ];
    docs.rows.sort(
      (a, b) =>
        prioridad.indexOf(a.tipo_documento) -
          prioridad.indexOf(b.tipo_documento) || a.orden - b.orden,
    );
    const segundo = await client.query<{ doble: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM solicitud_programa WHERE id_solicitud=$1 AND orden=2) AS doble`,
      [idSolicitud],
    );
    const doble = segundo.rows[0].doble;
    for (const doc of docs.rows) {
      informar(etapaDocumento(doc.tipo_documento, doc.orden, doble));
      const clave = doc.tipo_documento + (doc.orden === 2 ? '-2' : '');
      const archivo = archivos.find((a) => a.tipo === clave)!;
      let detalle: Record<string, unknown>;
      let estado = 'POR_REVISAR';
      let mensaje =
        'La validación de Paz y Salvo de Biblioteca está pendiente de integración. Requiere revisión humana.';
      if (doc.tipo_documento === 'paz_y_salvo_bib') {
        detalle = {
          estado_procesamiento: 'pendiente_integracion',
          extracted_data: {},
          rules: [],
          errors: [],
          mensaje,
        };
      } else {
        // Mismo servicio de POST /api/documentos/analizar; no se duplica el cliente ni los validadores.
        // Un documento por llamada: el motor usa document_order=1; se conserva la orden del transporte.
        const respuesta = await this.motor.analizar({
          estudianteJson: JSON.stringify(estudiante),
          tipos: doc.tipo_documento,
          archivos: [archivo],
        });
        if (
          !respuesta ||
          respuesta.id_student !== estudiante.id_student ||
          respuesta.nivel !== nivel ||
          !Array.isArray(respuesta.resultados) ||
          !Array.isArray(respuesta.errores) ||
          typeof respuesta.estado_general !== 'string' ||
          respuesta.resultados.length + respuesta.errores.length !== 1
        )
          throw new BadGatewayException(
            'El motor devolvió una respuesta documental inválida. Tu borrador se conserva.',
          );
        if (respuesta.errores.length) {
          // Un error de ejecución no es evidencia de que el documento sea inválido. Se revierte el envío.
          throw new BadGatewayException(
            'No fue posible completar el análisis de un documento. Tu borrador se conserva; revisa los PDF e intenta nuevamente.',
          );
        }
        const validado = DocumentValidationResult.safeParse(
          respuesta.resultados[0],
        );
        if (
          !validado.success ||
          validado.data.id_student !== estudiante.id_student ||
          validado.data.type_document !== doc.tipo_documento ||
          validado.data.document_version !== 1 ||
          (validado.data.document_order !== undefined &&
            validado.data.document_order !== 1)
        )
          throw new BadGatewayException(
            'El motor devolvió un resultado incompatible. Tu borrador se conserva.',
          );
        const r = validado.data;
        // Nunca aceptar valid si no hay reglas obligatorias evaluadas ni si el procesamiento falló.
        if (r.validation_status === 'completed') {
          if (
            r.document_classification === 'valid' &&
            r.errors.length === 0 &&
            r.rules.some((regla) => regla.mandatory) &&
            r.rules
              .filter((regla) => regla.mandatory)
              .every((regla) => regla.result === 'cumple')
          )
            estado = 'VALIDO';
          else if (r.document_classification === 'invalid')
            estado = 'NO_VALIDO';
          else if (r.document_classification === 'inconsistent')
            estado = 'INCONSISTENTE';
        }
        mensaje =
          r.validation_status === 'failed'
            ? 'No se pudo completar la lectura. Requiere revisión.'
            : estado === 'VALIDO'
              ? 'Validación documental completada.'
              : 'Consulta las observaciones del análisis documental.';
        detalle = {
          ...r,
          document_order: doc.orden,
          document_version: doc.version,
          version_motor: r.document_version,
          estado_general_motor: respuesta.estado_general,
          mensaje,
        };
      }
      const ruta = await this.temporales.guardar(archivo.buffer);
      creados.push(ruta);
      await client.query(
        `UPDATE documentos SET estado = $2, hash_archivo = $3, nombre_original = $4,
        tamano_bytes = $5 WHERE id_documento = $1`,
        [
          doc.id_documento,
          estado,
          createHash('sha256').update(archivo.buffer).digest('hex'),
          archivo.originalname,
          archivo.buffer.length,
        ],
      );
      await client.query(
        `INSERT INTO rutas (id_documento, ruta_archivo, nombre_archivo_servidor, expira_en)
        SELECT $1, $2, $2, ((p.fecha_fin + 16)::timestamp AT TIME ZONE 'America/Bogota')
        FROM solicitud_grado s JOIN periodos_grado p ON p.id = s.id_periodo WHERE s.id_solicitud = $3`,
        [doc.id_documento, ruta, idSolicitud],
      );
      const resultado = estado === 'POR_REVISAR' ? 'PENDIENTE' : estado;
      const v = await client.query<{ id_validacion: number }>(
        `INSERT INTO validaciones
        (id_documento, tipo_validacion, resultado, mensaje, detalle) VALUES ($1, 'OCR', $2, $3, $4::jsonb) RETURNING id_validacion`,
        [doc.id_documento, resultado, mensaje, JSON.stringify(detalle)],
      );
      await client.query(
        `INSERT INTO historial_validaciones (id_validacion, estado_anterior, estado_nuevo, observacion)
        VALUES ($1, NULL, $2, $3)`,
        [
          v.rows[0].id_validacion,
          resultado,
          'Análisis de la entrega registrado; el resultado completo se conserva en validaciones.detalle.',
        ],
      );
    }
    informar('Generando análisis documental.');
  }
  async descartar(claves: string[]) {
    // Los huérfanos no eliminados serán recuperados por el barrido tras 24 h.
    await Promise.allSettled(claves.map((c) => this.temporales.eliminar(c)));
  }
}
