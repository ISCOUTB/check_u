import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const fetchReal = globalThis.fetch;
const PERIODO = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const PDF = Buffer.from('%PDF-1.4\nPDF sintético de transporte\n%%EOF');
const TIPOS = [
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
];
const DATOS = {
  nivel: 'PREGRADO',
  nombres: 'Estudiante',
  apellidos: 'Prueba',
  codigoEstudiantil: 'T00000001',
  perfil: {
    tipoDocumento: 'CC',
    numeroDocumento: '1000000001',
    celular: '3001234567',
  },
  segundoPrograma: false,
  programas: [
    {
      orden: 1,
      programa: 'Ingeniería',
      modalidad: 'PRESENCIAL',
      tipoOpcionGrado: 'PROYECTO',
    },
  ],
  pregrado: { conoceRegistroSaberPro: false },
};

describe('Tarea 44: cancelación lógica y consulta histórica', () => {
  let app: INestApplication<App>,
    base: Awaited<ReturnType<typeof crearDbBorrador>>,
    estudiante: ReturnType<typeof request.agent>,
    funcionaria: ReturnType<typeof request.agent>,
    carpeta: string;
  let motor: ReturnType<typeof vi.fn>;
  beforeAll(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'checku44-'));
    process.env.DOCUMENTOS_TEMP_DIR = carpeta;
    base = await crearDbBorrador();
    await base.db.exec(
      "INSERT INTO usuarios(id_usuario,nombres,apellidos,correo,rol,codigo_estudiante) VALUES(999,'Otra','Persona','otra@example.org','ESTUDIANTE','T00000999')",
    );
    // PGlite tiene una conexión: serializar transacciones evita intercalar BEGIN de dos peticiones.
    // En PostgreSQL el Pool usa conexiones separadas y el servicio bloquea la fila con FOR UPDATE.
    let cola: Promise<unknown> = Promise.resolve();
    const servicio = {
      ...base.servicio,
      transaction<T>(cb: Parameters<typeof base.servicio.transaction<T>>[0]) {
        const siguiente = cola.then(() => base.servicio.transaction(cb));
        cola = siguiente.then(
          () => undefined,
          () => undefined,
        );
        return siguiente;
      },
    };
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(servicio)
      .compile();
    app = m.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.enableCors({ origin: 'http://127.0.0.1:3005', credentials: true });
    await app.init();
    estudiante = request.agent(app.getHttpServer());
    funcionaria = request.agent(app.getHttpServer());
    await estudiante
      .post('/api/auth/login')
      .send({ username: 'lizapata@utb.edu.co', password: '12345' })
      .expect(201);
    await funcionaria
      .post('/api/auth/login')
      .send({ username: 'rmarriaga@utb.edu.co', password: '12345' })
      .expect(201);
  }, 30000);
  beforeEach(async () => {
    await base.db
      .exec(`DROP TRIGGER IF EXISTS trg_fallar_cancelacion ON cancelaciones_preinscripcion;
      TRUNCATE cancelaciones_preinscripcion,notificaciones,revisiones,historial_validaciones,validaciones,rutas,documentos,entregas,
      experiencia_laboral,informacion_posgrado,informacion_pregrado,solicitud_programa,perfil_estudiante,solicitud_grado,periodos_grado RESTART IDENTITY CASCADE;
      INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion)
      VALUES('${PERIODO}','Periodo asignado',CURRENT_DATE-60,CURRENT_DATE+30,CURRENT_DATE+60)`);
    motor = vi.fn(async (_url, opts) => {
      const form = opts.body as FormData,
        tipo = form.get('tipos') as string;
      return Response.json({
        id_student: 'T00000001',
        nivel: 'PREGRADO',
        estado_general: 'invalid',
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
                result: 'no_cumple',
                mandatory: true,
                no_evaluable_reason: null,
                message: 'Documento por corregir.',
                timestamp: '2026-10-31T12:00:00Z',
                errors: [],
              },
            ],
            errors: [],
            document_classification: 'invalid',
            validation_status: 'completed',
            validation_version: 'test@1',
            timestamp: '2026-10-31T12:00:00Z',
            resubmission_allowed: true,
            required_action: 'upload_new_version',
            resubmission_reason: 'Corrige el documento.',
          },
        ],
      });
    });
    globalThis.fetch = motor as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = fetchReal;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await app?.close();
    await base?.db.close();
    await rm(carpeta, { recursive: true, force: true });
    delete process.env.DOCUMENTOS_TEMP_DIR;
  });
  async function crear(
    estado = 'EN_PROCESO',
    propietario = 1,
    periodo: string | null = PERIODO,
  ) {
    return (
      await base.db.query(
        "INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo) VALUES($1,'PREGRADO',$2,$3) RETURNING id_solicitud",
        [propietario, estado, periodo],
      )
    ).rows[0].id_solicitud as number;
  }
  it.each(['PREGRADO', 'POSGRADO'])(
    'reanuda un borrador %s con el nivel persistido en el destino',
    async (nivel) => {
      await crear('BORRADOR');
      await base.db.query('UPDATE solicitud_grado SET tipo_solicitud=$1', [
        nivel,
      ]);
      const respuesta = await estudiante
        .get('/api/solicitudes/estado')
        .expect(200);
      expect(respuesta.body).toMatchObject({
        ok: true,
        estado: 'BORRADOR',
        nivel,
        destino: `/estudiante/iniciar_preinscripcion?nivel=${nivel}`,
      });
    },
  );
  function cancelar(id = 1) {
    return estudiante.post(`/api/estudiante/solicitudes/${id}/cancelacion`);
  }
  function enviar() {
    let r = estudiante
      .post('/api/solicitudes/enviar')
      .field('datos', JSON.stringify(DATOS))
      .field('tipos', TIPOS.join(','));
    for (const t of TIPOS)
      r = r.attach('documentos', PDF, {
        filename: t + '.pdf',
        contentType: 'application/pdf',
      });
    return r;
  }
  const detalle = (id = 1) =>
    estudiante.get(`/api/estudiante/solicitudes/${id}/analisis`);
  async function datosDocumentales() {
    const datos: Record<string, unknown[]> = {};
    for (const tabla of [
      'documentos',
      'rutas',
      'validaciones',
      'historial_validaciones',
      'entregas',
      'solicitud_programa',
      'informacion_pregrado',
    ])
      datos[tabla] = (await base.db.query(`SELECT * FROM ${tabla}`)).rows;
    return datos;
  }
  it('la migración se puede repetir y conserva el estado cancelado y su auditoría', async () => {
    await crear();
    await cancelar().expect(201);
    const antes = (
      await base.db.query('SELECT * FROM cancelaciones_preinscripcion')
    ).rows;
    const sql = await readFile(
      new URL(
        '../../db/migrations/008-cancelacion-preinscripcion.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await base.db.exec(sql);
    await base.db.exec(sql);
    expect(
      (await base.db.query('SELECT * FROM cancelaciones_preinscripcion')).rows,
    ).toEqual(antes);
    expect((await detalle()).body.estadoSolicitud).toBe('CANCELADA');
  });
  it.each([
    'BORRADOR',
    'POR_REVISAR',
    'VALIDA',
    'NO_VALIDA',
    'INCONSISTENTE',
    'CERRADA',
  ])('rechaza cancelar desde %s sin modificar información', async (estado) => {
    await crear(estado);
    await cancelar().expect(409);
    expect(
      (await base.db.query('SELECT estado FROM solicitud_grado')).rows[0]
        .estado,
    ).toBe(estado);
    expect(
      (await base.db.query('SELECT * FROM cancelaciones_preinscripcion')).rows,
    ).toHaveLength(0);
  });
  it('exige sesión y rol estudiante en cancelación, listado y detalle', async () => {
    await crear();
    for (const ruta of [
      '/api/estudiante/solicitudes',
      '/api/estudiante/solicitudes/1/analisis',
    ]) {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await funcionaria.get(ruta).expect(403);
    }
    await request(app.getHttpServer())
      .post('/api/estudiante/solicitudes/1/cancelacion')
      .expect(401);
    await funcionaria
      .post('/api/estudiante/solicitudes/1/cancelacion')
      .expect(403);
  });
  it('no permite cancelar ni consultar una solicitud ajena aunque se manipule el destinatario', async () => {
    await crear('EN_PROCESO', 999);
    await cancelar()
      .send({ id_estudiante: 999, estado: 'EN_PROCESO' })
      .expect(404);
    await detalle().expect(404);
    const lista = await estudiante
      .get('/api/estudiante/solicitudes?id_estudiante=999')
      .expect(200);
    expect(lista.body.solicitudes).toEqual([]);
    expect(
      (await base.db.query('SELECT estado FROM solicitud_grado')).rows[0]
        .estado,
    ).toBe('EN_PROCESO');
  });
  it.each(['abc', '-1', '0', '2147483648', '9007199254740993', '1.5'])(
    'valida el identificador %s',
    async (id) => {
      await estudiante
        .post(`/api/estudiante/solicitudes/${id}/cancelacion`)
        .expect(400);
      await estudiante
        .get(`/api/estudiante/solicitudes/${id}/analisis`)
        .expect(400);
    },
  );
  it('cancelar un ID inexistente devuelve 404', async () => {
    await cancelar(999).expect(404);
  });
  it('cancela sin borrar ni cambiar documentos, validaciones, entregas o programa; mantiene el PDF privado', async () => {
    await enviar().expect(201);
    const antes = await datosDocumentales();
    const res = await cancelar().expect(201);
    expect(res.body).toMatchObject({
      ok: true,
      id: '1',
      estado: 'CANCELADA',
      yaCancelada: false,
    });
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(await datosDocumentales()).toEqual(antes);
    const d = (await detalle().expect(200)).body;
    expect(d.documentos).toHaveLength(5);
    expect(
      d.documentos.every(
        (doc: { resubmission_allowed: boolean }) => !doc.resubmission_allowed,
      ),
    ).toBe(true);
    expect(d.politicaReenvios.limite).toBe(0);
    expect(d.cancelacion.permitida).toBe(false);
    const pdf = await estudiante
      .get(`/api/estudiante/documentos/${d.documentos[0].id}/original`)
      .expect(200);
    expect(pdf.body).toEqual(PDF);
  });
  it('los reintentos de cancelación no duplican auditoría ni cambian la fecha original', async () => {
    await crear();
    const a = await cancelar().expect(201),
      b = await cancelar().expect(201);
    expect(b.body).toMatchObject({
      yaCancelada: true,
      canceladaEn: a.body.canceladaEn,
    });
    const res = await Promise.all([cancelar(), cancelar(), cancelar()]);
    expect(res.every((r) => r.status === 201)).toBe(true);
    expect(
      (await base.db.query('SELECT * FROM cancelaciones_preinscripcion')).rows,
    ).toHaveLength(1);
  });
  it('revierte el cambio de estado si falla la auditoría', async () => {
    await crear();
    await base.db
      .exec(`CREATE OR REPLACE FUNCTION checku_fallar_cancelacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo controlado'; END $$;
      CREATE TRIGGER trg_fallar_cancelacion BEFORE INSERT ON cancelaciones_preinscripcion FOR EACH ROW EXECUTE FUNCTION checku_fallar_cancelacion();`);
    await cancelar().expect(500);
    expect(
      (await base.db.query('SELECT estado FROM solicitud_grado')).rows[0]
        .estado,
    ).toBe('EN_PROCESO');
    expect(
      (await base.db.query('SELECT * FROM cancelaciones_preinscripcion')).rows,
    ).toHaveLength(0);
  });
  it('impide reactivación, reasignación y eliminación de la auditoría incluso a nivel SQL', async () => {
    await crear();
    await cancelar().expect(201);
    await expect(
      base.db.exec(
        "UPDATE solicitud_grado SET estado='EN_PROCESO' WHERE id_solicitud=1",
      ),
    ).rejects.toThrow();
    await expect(
      base.db.exec(
        'UPDATE solicitud_grado SET id_periodo=NULL WHERE id_solicitud=1',
      ),
    ).rejects.toThrow();
    await expect(
      base.db.exec('DELETE FROM cancelaciones_preinscripcion'),
    ).rejects.toThrow();
    await expect(
      base.db.exec(
        "UPDATE cancelaciones_preinscripcion SET informacion_estudiante='{}'",
      ),
    ).rejects.toThrow();
    await expect(
      base.db.exec('DELETE FROM solicitud_grado WHERE id_solicitud=1'),
    ).rejects.toThrow();
  });
  it('deja de ser activa, conserva su entrada histórica y no aparece pendiente en el dashboard', async () => {
    await crear();
    await cancelar().expect(201);
    expect(
      (await estudiante.get('/api/estudiante/solicitud').expect(200)).body
        .tiene_solicitud,
    ).toBe(false);
    expect(
      (await estudiante.get('/api/solicitudes/estado').expect(200)).body,
    ).toMatchObject({
      estado: 'SIN_SOLICITUD',
      destino: '/estudiante/bienvenida',
    });
    const lista = await estudiante
      .get('/api/estudiante/solicitudes')
      .expect(200);
    expect(lista.body.solicitudes[0]).toMatchObject({
      id: '1',
      estado: 'CANCELADA',
      activa: false,
      periodo: { id: PERIODO, nombre: 'Periodo asignado' },
    });
    expect(lista.body.solicitudes[0].canceladaEn).toBeTruthy();
    expect(
      (await funcionaria.get('/api/funcionario/solicitudes').expect(200)).body,
    ).toEqual([]);
  });
  it('bloquea correcciones y decisiones manuales después de cancelar, sin volver a invocar el motor', async () => {
    await enviar().expect(201);
    const d = (await detalle()).body.documentos[0];
    await cancelar().expect(201);
    motor.mockClear();
    await estudiante
      .post('/api/solicitudes/1/correcciones')
      .field('ids', JSON.stringify([Number(d.id)]))
      .field('clave', 'cancelacion-test')
      .attach('documentos', PDF, {
        filename: 'correccion.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);
    for (const accion of ['aceptada', 'anulada', 'recarga'])
      await funcionaria
        .post('/api/funcionario/solicitudes/1/revisiones')
        .send({ accion, documentos: [Number(d.id)] })
        .expect(409);
    expect(motor).not.toHaveBeenCalled();
  });
  it('no genera nuevos recordatorios de plazo para una cancelada', async () => {
    await crear();
    await base.db.exec('UPDATE periodos_grado SET fecha_fin=CURRENT_DATE+3');
    await cancelar().expect(201);
    await app.get(NotificacionesService).generarRecordatorios();
    expect(
      (
        await base.db.query(
          "SELECT * FROM notificaciones WHERE titulo='Plazo por vencer'",
        )
      ).rows,
    ).toEqual([]);
  });
  it('no permite una nueva preinscripción en el mismo periodo cancelado', async () => {
    await crear();
    await cancelar().expect(201);
    const res = await estudiante
      .post('/api/solicitudes/borrador')
      .send(DATOS)
      .expect(409);
    expect(res.body.codigo).toBe('SIN_PERIODO_DISPONIBLE');
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(1);
  });
  it('permite un periodo diferente sin reactivar la cancelada ni sobrescribir su perfil histórico', async () => {
    await enviar().expect(201);
    const anterior = (await detalle()).body;
    await cancelar().expect(201);
    await base.db.exec(
      `INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion) VALUES('${OTRO}','Otro periodo',CURRENT_DATE-10,CURRENT_DATE+45,CURRENT_DATE+60)`,
    );
    const r = await estudiante
      .post('/api/solicitudes/borrador')
      .send({
        ...DATOS,
        nombres: 'Nombre nuevo',
        perfil: { ...DATOS.perfil, celular: '3007654321' },
      })
      .expect(201);
    expect(r.body.id_solicitud).toBe(2);
    expect(r.body.periodos.periodoAsignado.id).toBe(OTRO);
    const historico = (await detalle(1).expect(200)).body;
    expect(historico.estadoSolicitud).toBe('CANCELADA');
    expect(historico.estudiante.nombre).toBe(anterior.estudiante.nombre);
    expect(historico.informacion.telefonoCelular).toBe(
      anterior.informacion.telefonoCelular,
    );
    expect(
      (await estudiante.get('/api/solicitudes/estado')).body,
    ).toMatchObject({ estado: 'BORRADOR', id_solicitud: 2 });
    expect(
      (
        await estudiante.get('/api/estudiante/solicitudes')
      ).body.solicitudes.map((r: { estado: string }) => r.estado),
    ).toEqual(['BORRADOR', 'CANCELADA']);
  });
  it('el detalle predeterminado prioriza otra solicitud activa sobre una cancelada más reciente', async () => {
    await crear();
    await crear();
    await cancelar(2).expect(201);
    expect(
      (await estudiante.get('/api/solicitudes/estado')).body.id_solicitud,
    ).toBe(1);
    expect(
      (await estudiante.get('/api/estudiante/solicitud/analisis')).body.id,
    ).toBe('1');
    expect((await detalle(2)).body.estadoSolicitud).toBe('CANCELADA');
  });
  it('calcula días hasta fecha_fin menos siete con el día de Bogotá y no con el día UTC', async () => {
    await crear();
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_inicio='2026-10-01',fecha_fin='2026-11-10',fecha_graduacion='2026-12-01'",
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T04:59:59Z'));
    expect((await detalle()).body.cancelacion).toMatchObject({
      fechaActual: '2026-10-30',
      fechaCorte: '2026-11-03',
      diasRestantes: 4,
      nombrePeriodo: 'Periodo asignado',
    });
    vi.setSystemTime(new Date('2026-10-31T05:00:00Z'));
    expect((await detalle()).body.cancelacion.diasRestantes).toBe(3);
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    await estudiante
      .post('/api/auth/login')
      .send({ username: 'lizapata@utb.edu.co', password: '12345' })
      .expect(201);
    expect((await detalle()).body.cancelacion.diasRestantes).toBe(0);
  });
  it('no inventa fechas si una solicitud histórica no tiene periodo', async () => {
    await crear('EN_PROCESO', 1, null);
    expect((await detalle()).body.cancelacion).toMatchObject({
      permitida: true,
      nombrePeriodo: null,
      fechaCorte: null,
      diasRestantes: null,
    });
    await cancelar().expect(201);
  });
  it.skipIf(process.env.CANCELACION_UI_REAL !== '1')(
    'cancelación desde el navegador con API y PostgreSQL reales, historial y nuevo periodo',
    async () => {
      await enviar().expect(201);
      await base.db.exec('UPDATE periodos_grado SET fecha_fin=CURRENT_DATE+10');
      const antes = await datosDocumentales();
      await app.listen(3000, '127.0.0.1');
      const require = createRequire(import.meta.url);
      const { chromium } = require('../../frontend/node_modules/playwright');
      const next = spawn(
        process.execPath,
        [
          'node_modules/next/dist/bin/next',
          'dev',
          '--webpack',
          '-H',
          '127.0.0.1',
          '-p',
          '3005',
        ],
        {
          cwd: new URL('../../frontend/', import.meta.url),
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3000/api',
          },
          stdio: 'ignore',
        },
      );
      let browser;
      try {
        let listo = false;
        for (let i = 0; i < 100; i++) {
          if (next.exitCode !== null)
            throw new Error('No pudo iniciar el frontend.');
          try {
            if ((await fetchReal('http://127.0.0.1:3005')).ok) {
              listo = true;
              break;
            }
          } catch {
            /* esperar arranque */
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(listo).toBe(true);
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
          viewport: { width: 1280, height: 1000 },
          reducedMotion: 'reduce',
        });
        expect(
          (
            await contexto.request.post(
              'http://127.0.0.1:3000/api/auth/login',
              { data: { username: 'lizapata@utb.edu.co', password: '12345' } },
            )
          ).status(),
        ).toBe(201);
        const pagina = await contexto.newPage();
        await pagina.goto('http://127.0.0.1:3005/estudiante/preinscripcion');
        await pagina
          .getByRole('button', { name: 'Cancelar preinscripción', exact: true })
          .click();
        expect(await pagina.getByRole('dialog').textContent()).toContain(
          'Periodo asignado',
        );
        const respuesta = pagina.waitForResponse(
          (r) =>
            r.url().endsWith('/estudiante/solicitudes/1/cancelacion') &&
            r.request().method() === 'POST',
        );
        await pagina
          .getByRole('button', { name: 'Confirmar cancelación', exact: true })
          .click();
        expect((await respuesta).status()).toBe(201);
        await pagina
          .getByRole('heading', {
            name: 'Preinscripción cancelada',
            exact: true,
          })
          .waitFor();
        expect(
          await pagina.getByRole('button', { name: 'Volver a cargar' }).count(),
        ).toBe(0);
        const panel = pagina.getByRole('region', {
          name: 'Historial de preinscripciones',
          exact: true,
        });
        await panel.getByText('CANCELADA', { exact: true }).waitFor();
        expect(await datosDocumentales()).toEqual(antes);
        expect(
          (await base.db.query('SELECT * FROM cancelaciones_preinscripcion'))
            .rows,
        ).toHaveLength(1);
        await pagina.waitForURL(
          'http://127.0.0.1:3005/estudiante/preinscripcion?solicitud=1',
        );
        await pagina.reload();
        await pagina
          .getByRole('heading', {
            name: 'Preinscripción cancelada',
            exact: true,
          })
          .waitFor();
        await pagina.goto('http://127.0.0.1:3005/estudiante/home');
        await pagina.waitForURL('http://127.0.0.1:3005/estudiante/bienvenida');
        await pagina
          .getByRole('link', { name: 'Ver detalle de solicitud 1' })
          .waitFor();
        await base.db.exec(
          `INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion) VALUES('${OTRO}','Nuevo periodo',CURRENT_DATE-5,CURRENT_DATE+45,CURRENT_DATE+60)`,
        );
        const nuevo = await contexto.request.post(
          'http://127.0.0.1:3000/api/solicitudes/borrador',
          { data: { ...DATOS, nombres: 'Nombre nuevo' } },
        );
        expect(nuevo.status()).toBe(201);
        expect((await nuevo.json()).periodos.periodoAsignado.id).toBe(OTRO);
        // Regresión: antes bienvenida y el formulario sin nivel se redirigían indefinidamente.
        for (const origen of ['home', 'bienvenida', 'iniciar_preinscripcion']) {
          await pagina.goto(`http://127.0.0.1:3005/estudiante/${origen}`);
          await pagina.waitForURL(
            'http://127.0.0.1:3005/estudiante/iniciar_preinscripcion?nivel=PREGRADO',
          );
          await pagina
            .getByRole('form', { name: 'Preinscripción de grado' })
            .waitFor();
          expect(
            await pagina
              .locator('input')
              .evaluateAll((inputs) =>
                inputs.some((input) => input.value === 'Nombre nuevo'),
              ),
          ).toBe(true);
          await pagina.reload();
          await pagina
            .getByRole('form', { name: 'Preinscripción de grado' })
            .waitFor();
          expect(new URL(pagina.url()).searchParams.get('nivel')).toBe(
            'PREGRADO',
          );
        }

        await pagina.goto(
          'http://127.0.0.1:3005/estudiante/preinscripcion?solicitud=1',
        );
        await pagina
          .getByRole('heading', {
            name: 'Preinscripción cancelada',
            exact: true,
          })
          .waitFor();
        expect(
          await pagina
            .getByRole('heading', { name: 'Estudiante Prueba', exact: true })
            .count(),
        ).toBe(1);
        await pagina
          .getByRole('link', { name: 'Ver detalle de solicitud 2' })
          .waitFor();
        expect(
          (
            await base.db.query(
              'SELECT estado FROM solicitud_grado ORDER BY id_solicitud',
            )
          ).rows.map((r) => r.estado),
        ).toEqual(['CANCELADA', 'BORRADOR']);
        await contexto.close();
      } finally {
        await browser?.close();
        next.kill('SIGTERM');
      }
    },
    120000,
  );
});
