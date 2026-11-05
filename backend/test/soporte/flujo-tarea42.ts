import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../../src/app.module.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { BibliotecaService } from '../../src/biblioteca/biblioteca.service.js';
import {
  claveDocumento,
  documentosASubir,
} from '../../src/solicitudes/requisitos-documentales.js';
import { crearDbBorrador } from './db-borrador.js';

// Tarea 42: la aplicación real sobre PGlite, con el motor y Biblioteca simulados. Solo datos inventados.

export const PERIODO = '11111111-1111-4111-8111-111111111111';

export type RespuestaBiblioteca =
  | 'paz_y_salvo'
  | 'con_deuda'
  | 'sin_respuesta'
  | 'inconsistente'
  | 'no_encontrado'
  | 'error'
  | 'invalido';

const ESTADO_BIBLIOTECA: Record<string, string> = {
  paz_y_salvo: 'cumple',
  con_deuda: 'no_cumple',
  sin_respuesta: 'no_evaluable',
  inconsistente: 'inconsistente',
  no_encontrado: 'no_encontrado',
};

/** Resultado con la forma de POST /biblioteca/paz-y-salvo del motor (datos inventados). */
export function resultadoBiblioteca(respuesta: RespuestaBiblioteca) {
  if (respuesta === 'invalido') return { foo: 1 };
  const estado = ESTADO_BIBLIOTECA[respuesta];
  const multas = estado === 'no_cumple' ? 1 : 0;
  return {
    user_id: 'T00000001',
    estado,
    paz_y_salvo:
      estado === 'cumple' ? true : estado === 'no_cumple' ? false : null,
    consultado_en: '2026-11-04T10:00:00-05:00',
    valido_hasta: null,
    criterios:
      estado === 'cumple' || estado === 'no_cumple'
        ? {
            prestamos: {
              resultado: 'cumple',
              motivo: null,
              mensaje: 'Sin préstamos.',
              pendientes: 0,
            },
            multas: {
              resultado: multas ? 'no_cumple' : 'cumple',
              motivo: null,
              mensaje: multas ? 'Tiene 1 multa pendiente.' : 'Sin multas.',
              pendientes: multas,
              valor_total: multas ? 15000 : 0,
              moneda: 'COP',
            },
            solicitudes: {
              resultado: 'cumple',
              motivo: null,
              mensaje: 'Sin solicitudes.',
              pendientes: 0,
            },
            opcion_grado: {
              resultado: 'no_evaluable',
              motivo: 'source_pending',
              mensaje: 'Sin fuente.',
              entregada: null,
              informativo: true,
            },
          }
        : {},
    acciones_requeridas: multas
      ? ['Pagar los cargos pendientes en Biblioteca.']
      : [],
    mensaje:
      estado === 'cumple'
        ? 'El estudiante cumple los criterios consultados de paz y salvo.'
        : estado === 'no_cumple'
          ? 'Tiene 1 multa pendiente.'
          : `Resultado de prueba: ${estado}.`,
    fuente: 'alma_simulada',
    identidad: {
      coincide:
        estado === 'inconsistente'
          ? false
          : estado === 'cumple' || estado === 'no_cumple'
            ? true
            : null,
      campos_distintos: estado === 'inconsistente' ? ['numero_documento'] : [],
    },
  };
}
export const PDF = Buffer.from(
  '%PDF-1.4\nDocumento sintético para transporte\n%%EOF',
);
export type Clasificacion = 'valid' | 'invalid' | 'inconsistent' | 'to_check';

export function datosPreinscripcion(nivel = 'PREGRADO', doble = false) {
  return {
    nivel,
    nombres: 'Estudiante',
    apellidos: 'Prueba',
    codigoEstudiantil: 'T00000001',
    perfil: { tipoDocumento: 'CC', numeroDocumento: '1000000001' },
    segundoPrograma: doble,
    programas: [
      {
        orden: 1,
        programa: 'Ingeniería',
        modalidad: 'PRESENCIAL',
        tipoOpcionGrado: 'TRABAJO_DE_GRADO',
      },
      ...(doble
        ? [
            {
              orden: 2,
              programa: 'Matemáticas',
              modalidad: 'PRESENCIAL',
              tipoOpcionGrado: 'TRABAJO_DE_GRADO',
            },
          ]
        : []),
    ],
    pregrado: { conoceRegistroSaberPro: false },
    posgrado: { nivelEstudios: 'PROFESIONAL', tituloObtenido: 'Ingeniero' },
  };
}

export interface Flujo {
  app: INestApplication<App>;
  base: Awaited<ReturnType<typeof crearDbBorrador>>;
  estudiante: ReturnType<typeof request.agent>;
  funcionaria: ReturnType<typeof request.agent>;
  /**
   * Clasificación que devuelve el motor. Se busca por el nombre del archivo sin `.pdf` (el envío usa
   * la clave, p. ej. `academic_evaluation-2`) y después por el tipo (`saber_pro`).
   */
  clasificacion: Record<string, Clasificacion>;
  /**
   * Respuesta de Biblioteca (Tarea 50: resultado del motor). Los nombres viejos se conservan:
   * paz_y_salvo → cumple, con_deuda → no_cumple, sin_respuesta → no_evaluable. 'error' hace que
   * la consulta lance y 'invalido' devuelve una forma que no es la del motor.
   */
  biblioteca: { respuesta: RespuestaBiblioteca; llamadas: number };
  /** Respuesta HTTP del motor; un número distinto de 200 simula una falla técnica. */
  motor: { estado: number; llamadas: string[] };
  cerrar(): Promise<void>;
}

export async function montarFlujo(): Promise<Flujo> {
  const carpeta = await mkdtemp(join(tmpdir(), 'checku42-'));
  process.env.DOCUMENTOS_TEMP_DIR = carpeta;
  const base = await crearDbBorrador();
  const biblioteca: Flujo['biblioteca'] = {
    respuesta: 'paz_y_salvo',
    llamadas: 0,
  };
  const m = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue(base.servicio)
    .overrideProvider(BibliotecaService)
    .useValue({
      consultar: () => {
        biblioteca.llamadas++;
        return biblioteca.respuesta === 'error'
          ? Promise.reject(new Error('Biblioteca no responde'))
          : Promise.resolve(resultadoBiblioteca(biblioteca.respuesta));
      },
    })
    .compile();
  const app = m.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  await app.init();
  const estudiante = request.agent(app.getHttpServer());
  const funcionaria = request.agent(app.getHttpServer());
  await estudiante
    .post('/api/auth/login')
    .send({ username: 'lizapata@utb.edu.co', password: '12345' })
    .expect(201);
  await funcionaria
    .post('/api/auth/login')
    .send({ username: 'rmarriaga@utb.edu.co', password: '12345' })
    .expect(201);
  const flujo: Flujo = {
    app,
    base,
    estudiante,
    funcionaria,
    clasificacion: {},
    biblioteca,
    motor: { estado: 200, llamadas: [] },
    async cerrar() {
      await app.close();
      await base.db.close();
      await rm(carpeta, { recursive: true, force: true });
      delete process.env.DOCUMENTOS_TEMP_DIR;
    },
  };
  return flujo;
}

/** Deja la base con un periodo cuyo fecha_fin es hoy (Bogotá) + diasHastaFin, y simula el motor. */
export async function reiniciar(flujo: Flujo, diasHastaFin = 30) {
  await flujo.base.db
    .exec(`TRUNCATE notificaciones,revisiones,historial_validaciones,validaciones,rutas,documentos,entregas,
    experiencia_laboral,informacion_posgrado,informacion_pregrado,solicitud_programa,perfil_estudiante,solicitud_grado,periodos_grado RESTART IDENTITY CASCADE`);
  await flujo.base.db.query(
    `INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion)
    SELECT $1,'Periodo prueba',hoy-60,hoy+$2::int,hoy+60
    FROM (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AS hoy) c`,
    [PERIODO, diasHastaFin],
  );
  flujo.clasificacion = {};
  flujo.biblioteca.respuesta = 'paz_y_salvo';
  flujo.biblioteca.llamadas = 0;
  flujo.motor.estado = 200;
  flujo.motor.llamadas = [];
  vi.stubGlobal('fetch', async (_url: unknown, opts: { body: FormData }) => {
    const tipo = opts.body.get('tipos') as string;
    flujo.motor.llamadas.push(tipo);
    if (flujo.motor.estado !== 200)
      return new Response('falla', { status: flujo.motor.estado });
    // El nombre del archivo distingue el documento del segundo programa (`academic_evaluation-2.pdf`).
    const archivo = (opts.body.get('documentos') as File | null)?.name ?? '';
    const clave = archivo.replace(/\.pdf$/, '');
    return Response.json(
      respuestaMotor(
        tipo,
        flujo.clasificacion[clave] ?? flujo.clasificacion[tipo] ?? 'valid',
        JSON.parse(opts.body.get('estudiante') as string).nivel as string,
      ),
    );
  });
}

/** El motor recibe un documento por llamada y siempre responde document_order 1. */
function respuestaMotor(
  tipo: string,
  clasificacion: Clasificacion,
  nivel: string,
) {
  const cumple = clasificacion === 'valid';
  return {
    id_student: 'T00000001',
    nivel,
    estado_general: clasificacion,
    errores: [],
    resultados: [
      {
        id_student: 'T00000001',
        type_document: tipo,
        document_version: 1,
        ...(tipo === 'estampilla_pro_cultura' ? { document_order: 1 } : {}),
        extracted_data: {},
        rules: [
          {
            rule: 'comprobacion',
            result: cumple ? 'cumple' : 'no_cumple',
            mandatory: true,
            no_evaluable_reason: null,
            message: cumple
              ? 'Documento verificado.'
              : 'El documento no cumple el requisito.',
            timestamp: '2026-10-31T12:00:00Z',
            errors: [],
          },
        ],
        errors: [],
        document_classification: clasificacion,
        validation_status: 'completed',
        validation_version: 'prueba@1',
        timestamp: '2026-10-31T12:00:00Z',
        resubmission_allowed: !cumple,
        required_action: cumple ? 'none' : 'upload_new_version',
        resubmission_reason: cumple ? null : 'Corrige el documento.',
      },
    ],
  };
}

/** Envía la preinscripción con un PDF por documento requerido (o las claves indicadas). */
export function enviar(
  flujo: Flujo,
  {
    nivel = 'PREGRADO',
    doble = false,
    claves,
  }: { nivel?: string; doble?: boolean; claves?: string[] } = {},
) {
  const tipos = claves ?? documentosASubir(nivel, doble).map(claveDocumento);
  let r = flujo.estudiante
    .post('/api/solicitudes/enviar')
    .field('datos', JSON.stringify(datosPreinscripcion(nivel, doble)))
    .field('tipos', tipos.join(','));
  for (const t of tipos)
    r = r.attach('documentos', PDF, {
      filename: t + '.pdf',
      contentType: 'application/pdf',
    });
  return r;
}

let claves = 0;
/** Reenvía los documentos indicados por id_documento con una clave de idempotencia nueva. */
export function reenviar(flujo: Flujo, idSolicitud: number, ids: number[]) {
  let r = flujo.estudiante
    .post(`/api/solicitudes/${idSolicitud}/correcciones`)
    .field('ids', JSON.stringify(ids))
    .field('clave', `reenvio-prueba-${++claves}`);
  for (const id of ids)
    r = r.attach('documentos', PDF, {
      filename: `corregido-${id}.pdf`,
      contentType: 'application/pdf',
    });
  return r;
}

/** Documentos actuales (última versión) por clave de transporte. */
export async function documentosActuales(flujo: Flujo, idSolicitud: number) {
  const r = await flujo.base.db.query<{
    id_documento: number;
    tipo_documento: string;
    orden: number;
    estado: string;
  }>(
    `SELECT DISTINCT ON (tipo_documento, orden) id_documento, tipo_documento, orden, estado
    FROM documentos WHERE id_solicitud=$1 AND id_entrega IS NOT NULL
    ORDER BY tipo_documento, orden, version DESC`,
    [idSolicitud],
  );
  return Object.fromEntries(
    r.rows.map((d) => [
      claveDocumento({ tipo: d.tipo_documento, orden: d.orden }),
      d,
    ]),
  );
}

export async function estadoSolicitud(flujo: Flujo, idSolicitud: number) {
  const r = await flujo.base.db.query<{ estado: string }>(
    'SELECT estado FROM solicitud_grado WHERE id_solicitud=$1',
    [idSolicitud],
  );
  return r.rows[0]?.estado;
}
