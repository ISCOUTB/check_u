import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { ArchivosTemporalesService } from '../src/solicitudes/archivos-temporales.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const fetchReal = globalThis.fetch;
const PDF = Buffer.from(
  '%PDF-1.4\nfixture de transporte; motor simulado en estas pruebas\n%%EOF',
);
const TIPOS = [
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
];
const datos = (nivel = 'PREGRADO', doble = false) => ({
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
            programa: 'Otro programa',
            modalidad: 'PRESENCIAL',
            tipoOpcionGrado: 'TRABAJO_DE_GRADO',
          },
        ]
      : []),
  ],
  pregrado: { conoceRegistroSaberPro: false },
  posgrado: { nivelEstudios: 'PROFESIONAL', tituloObtenido: 'Ingeniero' },
});
function resultado(tipo: string, id = 'T00000001') {
  return {
    id_student: id,
    type_document: tipo,
    ...(tipo === 'estampilla_pro_cultura' ? { document_order: 1 } : {}),
    document_version: 1,
    extracted_data: { first_name: { value: 'Estudiante', confidence: 0.95 } },
    rules: [
      {
        rule: 'documento',
        result: 'cumple',
        no_evaluable_reason: null,
        mandatory: true,
        message: 'Documento verificado',
        timestamp: '2026-10-27T03:00:00Z',
        errors: [],
      },
    ],
    errors: [],
    document_classification: 'valid',
    validation_status: 'completed',
    validation_version: 'test@1',
    timestamp: '2026-10-27T03:00:00Z',
    resubmission_allowed: false,
    required_action: 'none',
    resubmission_reason: null,
  };
}
describe('Tarea 36: multipart → motor → PostgreSQL → consulta de sesión → limpieza', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>;
  let app: INestApplication<App>;
  let agente: ReturnType<typeof request.agent>;
  let carpeta: string;
  let motor: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'checku-test-'));
    process.env.DOCUMENTOS_TEMP_DIR = carpeta;
    base = await crearDbBorrador();
    // El periodo incluye la fecha actual de PostgreSQL, no depende del reloj del host.
    await base.db
      .exec(`INSERT INTO periodos_grado (id, nombre, fecha_inicio, fecha_fin, fecha_graduacion, estado)
      VALUES ('11111111-1111-4111-8111-111111111111', 'Periodo de prueba', CURRENT_DATE - 1, CURRENT_DATE + 30, CURRENT_DATE + 60, 'ABIERTO')`);
    motor = vi.fn().mockImplementation(async (_url, options) => {
      const form = options.body as FormData;
      const tipo = String(form.get('tipos'));
      const estudiante = JSON.parse(String(form.get('estudiante')));
      expect(estudiante.id_student).toBe('T00000001');
      expect(form.getAll('documentos')).toHaveLength(1);
      return new Response(
        JSON.stringify({
          id_student: estudiante.id_student,
          nivel: estudiante.nivel,
          estado_general: 'valid',
          resultados: [resultado(tipo)],
          errores: [],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', motor);
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors({ origin: 'http://localhost:3004', credentials: true });
    await app.init();
    agente = request.agent(app.getHttpServer());
    await agente
      .post('/api/auth/login')
      .send({ username: 'lizapata@utb.edu.co', password: '12345' })
      .expect(201);
  }, 30000);
  afterEach(async () => {
    await app?.close();
    await base?.db.close();
    await rm(carpeta, { recursive: true, force: true });
    delete process.env.DOCUMENTOS_TEMP_DIR;
    vi.unstubAllGlobals();
  });
  function enviar(
    nivel = 'PREGRADO',
    doble = false,
    pdf = PDF,
    tipos?: string[],
  ) {
    const requeridos =
      tipos ??
      (nivel === 'PREGRADO'
        ? [
            ...TIPOS,
            ...(doble ? ['academic_evaluation-2', 'estampilla_pro_cultura-2'] : []),
          ]
        : ['identification', 'paz_y_salvo_bib', 'estampilla_pro_cultura']);
    let req = agente
      .post('/api/solicitudes/enviar')
      .field('datos', JSON.stringify(datos(nivel, doble)))
      .field('tipos', requeridos.join(','));
    for (const t of requeridos)
      req = req.attach('documentos', pdf, {
        filename: `${t}.pdf`,
        contentType: 'application/pdf',
      });
    return req;
  }
  it.each([
    ['PREGRADO', false, 5, 4],
    ['POSGRADO', false, 3, 2],
    ['PREGRADO', true, 7, 6],
  ] as const)(
    'persiste %s doble=%s y consulta después de nueva sesión',
    async (nivel, doble, cantidad, llamadas) => {
      const envio = await enviar(nivel, doble).expect(201);
      expect(envio.body.estado).toBe('VALIDA'); // Tarea 42a: estado calculado
      expect(motor).toHaveBeenCalledTimes(llamadas);
      const docs = await base.db.query(
        'SELECT * FROM documentos ORDER BY id_documento',
      );
      expect(docs.rows).toHaveLength(cantidad);
      expect(
        docs.rows.find((d) => d.tipo_documento === 'paz_y_salvo_bib')?.estado,
      ).toBe('VALIDO'); // Tarea 42: lo decide Biblioteca (demo: T00000001 está a paz y salvo)
      expect(
        (await base.db.query('SELECT * FROM validaciones')).rows,
      ).toHaveLength(cantidad);
      expect(
        (await base.db.query('SELECT * FROM historial_validaciones')).rows,
      ).toHaveLength(cantidad);
      expect(await readdir(carpeta)).toHaveLength(cantidad);
      const ruta = (
        await base.db.query('SELECT ruta_archivo FROM rutas LIMIT 1')
      ).rows[0].ruta_archivo as string;
      expect(await readFile(join(carpeta, ruta))).toEqual(PDF);
      await agente.post('/api/auth/logout').expect(201);
      await agente.get('/api/estudiante/solicitud/analisis').expect(401);
      await agente
        .post('/api/auth/login')
        .send({ username: 'lizapata@utb.edu.co', password: '12345' })
        .expect(201);
      const consulta = await agente
        .get(
          '/api/estudiante/solicitud/analisis?id_estudiante=999&id_solicitud=999',
        )
        .expect(200);
      expect(consulta.body.id).toBe(String(envio.body.id_solicitud));
      expect(consulta.body.documentos).toHaveLength(cantidad);
      expect(
        consulta.body.documentos.find((d) => d.tipo === 'identification')
          .analisis.extracted_data.first_name.value,
      ).toBe('Estudiante');
      await agente.get('/api/estudiante/solicitud/analisis').expect(200);
      expect(motor).toHaveBeenCalledTimes(llamadas);
      await enviar(nivel, doble).expect(409);
      expect(motor).toHaveBeenCalledTimes(llamadas);
    },
  );
  it('rechaza archivos falsos, tipos duplicados y documentos ausentes sin invocar el motor', async () => {
    await enviar('PREGRADO', false, Buffer.from('no PDF')).expect(400);
    await enviar('PREGRADO', false, PDF, [
      'identification',
      'identification',
    ]).expect(400);
    await enviar('PREGRADO', false, PDF, ['identification']).expect(400);
    expect(motor).not.toHaveBeenCalled();
  });
  it.each(['red', 'json', 'identidad', 'tipo', 'errores', 'abort'])(
    'fallo %s conserva borrador y revierte entrega, rutas y validaciones',
    async (modo) => {
      motor.mockReset().mockImplementation(async () => {
        if (modo === 'red') throw new Error('secret interno');
        if (modo === 'abort') throw new DOMException('timeout', 'AbortError');
        if (modo === 'json') return new Response('invalid json');
        return new Response(
          JSON.stringify({
            id_student: 'T00000001',
            nivel: 'PREGRADO',
            estado_general: 'valid',
            resultados:
              modo === 'errores'
                ? []
                : [
                    resultado(
                      modo === 'tipo' ? 'saber_pro' : 'identification',
                      modo === 'identidad' ? 'otra-persona' : 'T00000001',
                    ),
                  ],
            errores:
              modo === 'errores'
                ? [{ indice: 0, error: 'ruta interna /secret' }]
                : [],
          }),
        );
      });
      const res = await enviar();
      expect([502, 503]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(
        (await base.db.query('SELECT estado FROM solicitud_grado')).rows,
      ).toEqual([{ estado: 'BORRADOR' }]);
      expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
        0,
      );
      expect(
        (await base.db.query('SELECT * FROM validaciones')).rows,
      ).toHaveLength(0);
      expect((await base.db.query('SELECT * FROM rutas')).rows).toHaveLength(0);
      expect(await readdir(carpeta)).toHaveLength(0);
    },
  );
  it('fallo en el segundo documento revierte el primero y elimina su archivo temporal', async () => {
    motor
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              id_student: 'T00000001',
              nivel: 'PREGRADO',
              estado_general: 'valid',
              resultados: [resultado('identification')],
              errores: [],
            }),
          ),
      )
      .mockImplementationOnce(async () => {
        throw new Error('caída');
      });
    await enviar().expect(503);
    expect(
      (await base.db.query('SELECT * FROM validaciones')).rows,
    ).toHaveLength(0);
    expect(await readdir(carpeta)).toHaveLength(0);
  });
  it('un resultado valid sin reglas no produce éxito documental', async () => {
    motor.mockImplementation(async (_url, opts) => {
      const f = opts.body as FormData;
      return new Response(
        JSON.stringify({
          id_student: 'T00000001',
          nivel: 'PREGRADO',
          estado_general: 'valid',
          resultados: [{ ...resultado(String(f.get('tipos'))), rules: [] }],
          errores: [],
        }),
      );
    });
    await enviar().expect(201);
    expect(
      (
        await base.db.query(
          "SELECT * FROM documentos WHERE estado = 'VALIDO' AND tipo_documento <> 'paz_y_salvo_bib'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it('limpia al reiniciar: respeta periodo extendido, borra vencidos y conserva todo el historial', async () => {
    await enviar().expect(201);
    const limpieza = app.get(ArchivosTemporalesService);
    await base.db.exec(
      "UPDATE rutas SET expira_en = CURRENT_TIMESTAMP - INTERVAL '1 day'",
    );
    await limpieza.limpiar();
    expect(await readdir(carpeta)).toHaveLength(5); // recalcula según el periodo vigente, no la fecha obsoleta
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_inicio = CURRENT_DATE - 90, fecha_fin = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - 16)",
    );
    const reiniciado = new ArchivosTemporalesService(
      base.servicio as unknown as DatabaseService,
    );
    await reiniciado.limpiar();
    expect(await readdir(carpeta)).toHaveLength(0);
    expect(
      (
        await base.db.query(
          'SELECT * FROM rutas WHERE activa = FALSE AND eliminado_en IS NOT NULL',
        )
      ).rows,
    ).toHaveLength(5);
    expect(
      (await base.db.query('SELECT * FROM validaciones')).rows,
    ).toHaveLength(5);
    expect(
      (await base.db.query('SELECT * FROM historial_validaciones')).rows,
    ).toHaveLength(5);
    await agente.get('/api/estudiante/solicitud/analisis').expect(200);
  });
  it('no consulta otra preinscripción aunque se manipulen los identificadores de la URL', async () => {
    await base.db
      .exec(`INSERT INTO usuarios (id_usuario,nombres,apellidos,correo,rol,codigo_estudiante)
      VALUES (999, 'Otra', 'Persona', 'otra@example.org', 'ESTUDIANTE', 'T00000999');
      INSERT INTO solicitud_grado (id_estudiante,tipo_solicitud,estado) VALUES (999,'PREGRADO','EN_PROCESO')`);
    const r = await agente
      .get(
        '/api/estudiante/solicitud/analisis?id_estudiante=999&id_solicitud=999',
      )
      .expect(404);
    expect(JSON.stringify(r.body)).not.toContain('Otra');
  });
  it('conserva el día 15 completo, registra error de limpieza y reintenta sin borrar validaciones', async () => {
    await enviar().expect(201);
    const limpieza = app.get(ArchivosTemporalesService);
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_inicio = CURRENT_DATE - 90, fecha_fin = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - 15)",
    );
    await limpieza.limpiar();
    expect(await readdir(carpeta)).toHaveLength(5);
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_fin = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - 16)",
    );
    const fallo = vi
      .spyOn(limpieza, 'eliminar')
      .mockRejectedValueOnce(new Error('sin permisos'));
    await limpieza.limpiar();
    expect(
      (
        await base.db.query(
          'SELECT * FROM rutas WHERE activa = TRUE AND error_limpieza IS NOT NULL',
        )
      ).rows,
    ).toHaveLength(1);
    fallo.mockRestore();
    await limpieza.limpiar();
    expect(await readdir(carpeta)).toHaveLength(0);
    expect(
      (await base.db.query('SELECT * FROM validaciones')).rows,
    ).toHaveLength(5);
  });
  it.skipIf(process.env.OCR_REAL_TEST !== '1')(
    'motor real: PDF sintético, respuesta HTTP, persistencia y consulta',
    async () => {
      const generado = join(carpeta, 'sintetico.pdf');
      const proceso = spawnSync(process.env.OCR_TEST_PYTHON || 'python', [
        '-c',
        'import pymupdf,sys; d=pymupdf.open(); p=d.new_page(); p.insert_text((72,72), "DOCUMENTO SINTETICO DE PRUEBA - SIN DATOS PERSONALES"); d.save(sys.argv[1])',
        generado,
      ]);
      expect(proceso.status, String(proceso.stderr)).toBe(0);
      const pdf = await readFile(generado);
      await rm(generado);
      const respuestas: unknown[] = [];
      motor.mockImplementation(async (url, options) => {
        const res = await fetchReal(url, options);
        respuestas.push(await res.clone().json());
        return res;
      });
      const envio = await enviar('PREGRADO', false, pdf);
      expect(
        envio.status,
        JSON.stringify({ envio: envio.body, respuestas }),
      ).toBe(201);
      const consulta = await agente
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      expect(consulta.body.documentos).toHaveLength(5);
      expect(respuestas).toHaveLength(4);
      if (process.env.VERIFICAR_TAREA38 === '1') {
        const identidad = consulta.body.documentos.find(
          (d: { tipo: string }) => d.tipo === 'identification',
        );
        await agente
          .get(`/api/estudiante/documentos/${identidad.id}/original`)
          .expect(200)
          .expect('Content-Type', /application\/pdf/);
        const correccion = await agente
          .post('/api/solicitudes/1/correcciones')
          .set('Accept', 'application/x-ndjson')
          .field('ids', JSON.stringify([Number(identidad.id)]))
          .field('clave', 'tarea38-motor-real')
          .attach('documentos', pdf, {
            filename: 'identidad-corregida.pdf',
            contentType: 'application/pdf',
          });
        expect(correccion.status, correccion.text).toBe(200);
        const eventos = correccion.text
          .trim()
          .split('\n')
          .map((l: string) => JSON.parse(l));
        expect(eventos.at(-1).resultado.ok).toBe(true);
        expect(eventos.at(-2).porcentaje).toBe(100);
        const actualizada = await agente
          .get('/api/estudiante/solicitud/analisis')
          .expect(200);
        expect(
          actualizada.body.documentos.find(
            (d: { tipo: string }) => d.tipo === 'identification',
          ).version,
        ).toBe(2);
        expect(actualizada.body.politicaReenvios.usados).toBe(1);
        await agente
          .get(`/api/estudiante/documentos/${identidad.id}/original`)
          .expect(200);
      }

      if (process.env.CAPTURAR_UI_REAL === '1' && process.env.EVIDENCIAS_DIR) {
        app.enableCors({ origin: 'http://localhost:3004', credentials: true });
        await app.listen(3000, '0.0.0.0');
        const require = createRequire(import.meta.url);
        const { chromium } = require('../../frontend/node_modules/playwright');
        const next = spawn(
          process.execPath,
          [
            'node_modules/next/dist/bin/next',
            'dev',
            '-H',
            '127.0.0.1',
            '-p',
            '3004',
          ],
          {
            cwd: new URL('../../frontend/', import.meta.url),
            env: {
              ...process.env,
              NEXT_PUBLIC_API_URL: 'http://localhost:3000/api',
            },
            stdio: 'ignore',
          },
        );
        let browser;
        try {
          for (let i = 0; i < 100; i++) {
            try {
              if ((await fetchReal('http://localhost:3004')).ok) break;
            } catch {
              /* arranque */
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          browser = await chromium.launch({
            executablePath:
              process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
            args: [
              '--no-sandbox',
              '--no-zygote',
              '--use-gl=angle',
              '--use-angle=swiftshader',
              '--enable-unsafe-swiftshader',
              '--in-process-gpu',
            ],
          });
          const contexto = await browser.newContext({
            viewport: { width: 1366, height: 1000 },
          });
          await contexto.request.post('http://localhost:3000/api/auth/login', {
            data: { username: 'lizapata@utb.edu.co', password: '12345' },
          });
          const pagina = await contexto.newPage();
          await pagina.goto('http://localhost:3004/estudiante/preinscripcion');
          await pagina
            .getByRole('heading', { name: 'Detalle de mi preinscripción' })
            .waitFor({ timeout: 30000 });
          await pagina
            .getByRole('heading', {
              name: 'Documento de identidad',
              exact: true,
            })
            .waitFor();
          await pagina.screenshot({
            path: join(process.env.EVIDENCIAS_DIR, 'interfaz-real.png'),
            fullPage: true,
          });
          await pagina.reload();
          await pagina
            .getByRole('heading', {
              name: 'Documento de identidad',
              exact: true,
            })
            .waitFor();
          expect(
            await pagina
              .getByRole('button', { name: 'Ver análisis automático' })
              .count(),
          ).toBe(5);
        } finally {
          await browser?.close();
          next.kill();
        }
      }
      if (process.env.EVIDENCIAS_DIR) {
        await mkdir(process.env.EVIDENCIAS_DIR, { recursive: true });
        for (const [nombre, valor] of Object.entries({
          'motor-real.json': respuestas,
          'consulta-real.json': consulta.body,
          'persistencia-real.json': {
            solicitudes: (
              await base.db.query(
                'SELECT id_solicitud, id_estudiante, id_periodo, estado FROM solicitud_grado',
              )
            ).rows,
            documentos: (
              await base.db.query(
                'SELECT id_documento, id_solicitud, id_entrega, tipo_documento, estado FROM documentos',
              )
            ).rows,
            validaciones: (
              await base.db.query(
                'SELECT id_validacion, id_documento, resultado, detalle FROM validaciones',
              )
            ).rows,
            rutas: (
              await base.db.query(
                'SELECT id_documento, expira_en, activa FROM rutas',
              )
            ).rows,
          },
        }))
          await writeFile(
            join(process.env.EVIDENCIAS_DIR, nombre),
            JSON.stringify(valor, null, 2),
          );
      }
    },
    120000,
  );
  it('requiere sesión y no permite el rol funcionario', async () => {
    await request(app.getHttpServer())
      .get('/api/estudiante/solicitud/analisis')
      .expect(401);
    const otro = request.agent(app.getHttpServer());
    await otro
      .post('/api/auth/login')
      .send({ username: 'rmarriaga@utb.edu.co', password: '12345' })
      .expect(201);
    await otro.get('/api/estudiante/solicitud/analisis').expect(403);
  });
});
