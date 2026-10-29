import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const fetchReal = globalThis.fetch;
const TIPOS = [
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
];
const PDF = Buffer.from('%PDF-1.4\nDocumento sintético para transporte\n%%EOF');
const DATOS = {
  nivel: 'PREGRADO',
  nombres: 'Estudiante',
  apellidos: 'Prueba',
  codigoEstudiantil: 'T00000001',
  perfil: { tipoDocumento: 'CC', numeroDocumento: '1000000001' },
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

describe('Tarea 41: notificaciones persistidas, actores y propiedad', () => {
  let app: INestApplication<App>,
    base: Awaited<ReturnType<typeof crearDbBorrador>>,
    estudiante: ReturnType<typeof request.agent>,
    funcionaria: ReturnType<typeof request.agent>,
    svc: NotificacionesService,
    carpeta: string;
  let motor: ReturnType<typeof vi.fn>;
  let clasificacion = 'invalid';
  beforeAll(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'checku41-'));
    process.env.DOCUMENTOS_TEMP_DIR = carpeta;
    base = await crearDbBorrador();
    await base.db.exec(
      "INSERT INTO usuarios(id_usuario,nombres,apellidos,correo,rol,codigo_estudiante) VALUES(999,'Otra','Persona','otra@example.org','ESTUDIANTE','T00000999')",
    );
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    app = m.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors({ origin: 'http://127.0.0.1:3004', credentials: true });
    await app.init();
    svc = app.get(NotificacionesService);
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
      .exec(`TRUNCATE notificaciones,revisiones,historial_validaciones,validaciones,rutas,documentos,entregas,
      experiencia_laboral,informacion_posgrado,informacion_pregrado,solicitud_programa,perfil_estudiante,solicitud_grado,periodos_grado RESTART IDENTITY CASCADE;
      INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion)
      VALUES('11111111-1111-4111-8111-111111111111','Periodo prueba',CURRENT_DATE-60,CURRENT_DATE+30,CURRENT_DATE+60)`);
    clasificacion = 'invalid';
    motor = vi.fn().mockImplementation(async (_url, opts) => {
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
                result: clasificacion === 'valid' ? 'cumple' : 'no_cumple',
                mandatory: true,
                no_evaluable_reason: null,
                message:
                  clasificacion === 'valid'
                    ? 'Documento verificado.'
                    : 'El documento no corresponde al formato esperado.',
                timestamp: '2026-10-28T12:00:00Z',
                errors: [],
              },
            ],
            errors: [],
            document_classification: clasificacion,
            validation_status: 'completed',
            validation_version: 'prueba@1',
            timestamp: '2026-10-28T12:00:00Z',
            resubmission_allowed: clasificacion !== 'valid',
            required_action:
              clasificacion === 'valid' ? 'none' : 'upload_new_version',
            resubmission_reason:
              clasificacion === 'valid' ? null : 'Corrige el documento.',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', motor);
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await app?.close();
    await base?.db.close();
    await rm(carpeta, { recursive: true, force: true });
    delete process.env.DOCUMENTOS_TEMP_DIR;
  });
  async function solicitud(estado = 'EN_PROCESO') {
    const r = await base.db.query(
      `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo)
      VALUES(1,'PREGRADO',$1,'11111111-1111-4111-8111-111111111111') RETURNING id_solicitud`,
      [estado],
    );
    return r.rows[0].id_solicitud as number;
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
  function revisar(id: number, body: Record<string, unknown>) {
    return funcionaria
      .post(`/api/funcionario/solicitudes/${id}/revisiones`)
      .send(body);
  }

  it('listado y detalle de revisión usan solicitudes reales, protegen roles y respetan el ID histórico', async () => {
    const id = await solicitud();
    const segundo = await solicitud('BORRADOR');
    await revisar(id, {accion:'comentario', comentario:'Historial completo de la primera solicitud'}).expect(201);
    const listado = await funcionaria.get('/api/funcionario/solicitudes').expect(200);
    expect(listado.headers['cache-control']).toBe('private, no-store');
    expect(listado.body.map((r: {id: string}) => r.id)).toEqual([String(segundo),String(id)]);
    const detalle = await funcionaria.get(`/api/funcionario/solicitudes/${id}`).expect(200);
    expect(detalle.body.id).toBe(String(id));
    expect(detalle.body.estadoSolicitud).toBe('EN_PROCESO');
    expect(detalle.body.revisiones[0].comentario).toBe('Historial completo de la primera solicitud');
    await funcionaria.get('/api/funcionario/solicitudes/999999').expect(404);
    await funcionaria.get('/api/funcionario/solicitudes/invalido').expect(400);
    for (const ruta of ['/api/funcionario/solicitudes', `/api/funcionario/solicitudes/${id}`, '/api/funcionario/documentos/1/original']) {
      await estudiante.get(ruta).expect(403);
      await request(app.getHttpServer()).get(ruta).expect(401);
    }
  });

  it('la funcionaria visualiza el PDF real y los resultados actuales, sin exponerlo a otros estudiantes', async () => {
    await enviar().expect(201);
    const detalle = await funcionaria.get('/api/funcionario/solicitudes/1').expect(200);
    expect(detalle.body.documentos).toHaveLength(5);
    const doc = detalle.body.documentos[0];
    expect(doc.archivoDisponible).toBe(true);
    const r = await funcionaria.get(`/api/funcionario/documentos/${doc.id}/original`).expect(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(r.body).toEqual(PDF);
    await funcionaria.get('/api/funcionario/documentos/999999/original').expect(404);
    await base.db.exec('UPDATE periodos_grado SET fecha_fin=CURRENT_DATE-17,fecha_inicio=CURRENT_DATE-60');
    await funcionaria.get(`/api/funcionario/documentos/${doc.id}/original`).expect(410);
  });

  it('la migración es repetible y los valores están restringidos', async () => {
    const sql = await readFile(
      new URL('../../db/migrations/007-notificaciones.sql', import.meta.url),
      'utf8',
    );
    await base.db.exec(sql);
    await base.db.exec(sql);
    await expect(
      base.db.query(
        "INSERT INTO notificaciones(estudiante_id,tipo,titulo,msg,generado_por,clave_evento) VALUES(1,'inventado','Título','Mensaje','system','prueba')",
      ),
    ).rejects.toThrow();
    await expect(
      base.db.query(
        "SELECT crear_notificacion(2,'info','Título','Mensaje','system','funcionario-receptor')",
      ),
    ).rejects.toThrow();
  });
  it('exige sesión y separa los permisos de estudiante y funcionaria', async () => {
    await request(app.getHttpServer())
      .get('/api/estudiante/notificaciones')
      .expect(401);
    await funcionaria.get('/api/estudiante/notificaciones').expect(403);
    await funcionaria
      .patch('/api/estudiante/notificaciones/1/leida')
      .expect(403);
    for (const accion of [
      'toString',
      'constructor',
      '__proto__',
      'inventada',
    ]) {
      await funcionaria
        .post('/api/funcionario/solicitudes/1/revisiones')
        .send({ accion })
        .expect(400);
    }
    await estudiante
      .post('/api/funcionario/solicitudes/1/revisiones')
      .send({ accion: 'aceptada' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/estudiante/notificaciones/1/leida')
      .expect(401);
  });
  it('lista solo las propias, ordena por fecha/id y presenta fecha y hora de Bogotá', async () => {
    await base.db.query(
      "SELECT crear_notificacion(999,'info','Privada','No debe verse','system','ajena')",
    );
    await base.db.query(
      "SELECT crear_notificacion(1,'info','Antigua','Anterior','system','propia1')",
    );
    await base.db.query(
      "SELECT crear_notificacion(1,'success','Reciente','Actual','motor','propia2')",
    );
    await base.db.exec(
      "UPDATE notificaciones SET creado_en='2026-10-29T02:30:00Z' WHERE clave_evento IN ('propia1','propia2')",
    );
    const r = await estudiante
      .get('/api/estudiante/notificaciones?estudiante_id=999')
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(r.body.notificaciones.map((n) => n.titulo)).toEqual([
      'Reciente',
      'Antigua',
    ]);
    expect(r.body.notificaciones[0]).toMatchObject({
      fecha: '2026-10-28',
      hora: '21:30:00',
      leida: false,
      creadoEn: '2026-10-29T02:30:00.000Z',
    });
    expect(r.body.noLeidas).toBe(2);
    expect(JSON.stringify(r.body)).not.toContain('Privada');
  });
  it.each([
    ['aceptada', 'Solicitud aceptada', 'info', 'VALIDA'],
    ['anulada', 'Solicitud anulada', 'error', 'CERRADA'],
  ])(
    'la acción %s registra revisión, aviso y estado juntos',
    async (accion, titulo, tipo, estado) => {
      const id = await solicitud();
      await revisar(id, { accion }).expect(201);
      const n = (
        await estudiante.get('/api/estudiante/notificaciones').expect(200)
      ).body.notificaciones;
      expect(n).toHaveLength(1);
      expect(n[0]).toMatchObject({ titulo, tipo, generado_por: 'funcionario' });
      expect(
        (await base.db.query('SELECT estado FROM solicitud_grado')).rows[0]
          .estado,
      ).toBe(estado);
      await revisar(id, { accion }).expect(409);
    },
  );
  it.each([
    'Corto',
    'QuinceCaracteres',
    'QuinceCaracteres y más',
    '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀X',
  ])(
    'el comentario limita su vista previa sin perder el original: %s',
    async (texto) => {
      const id = await solicitud();
      await revisar(id, { accion: 'comentario', comentario: texto }).expect(
        201,
      );
      const esperado =
        Array.from(texto).slice(0, 15).join('') +
        (Array.from(texto).length > 15 ? '…' : '');
      const n = (await estudiante.get('/api/estudiante/notificaciones')).body
        .notificaciones[0];
      expect(n.msg).toBe('La funcionaria te dejó un comentario: ' + esperado);
      expect(
        (await base.db.query('SELECT comentario FROM revisiones')).rows[0]
          .comentario,
      ).toBe(texto);
    },
  );
  it('una revisión persistida por otro módulo también genera su notificación', async () => {
    const id = await solicitud();
    await base.db.query(
      "INSERT INTO revisiones(id_solicitud,id_funcionario,resultado) VALUES($1,2,'APROBADA')",
      [id],
    );
    expect(
      (await estudiante.get('/api/estudiante/notificaciones')).body
        .notificaciones[0].titulo,
    ).toBe('Solicitud aceptada');
  });
  it('recarga enumera los documentos elegidos sin notificar versiones viejas ni documentos ajenos', async () => {
    await enviar().expect(201);
    const docs = (
      await base.db.query(
        "SELECT id_documento FROM documentos WHERE tipo_documento IN ('identification','estampilla_pro_cultura') ORDER BY id_documento",
      )
    ).rows.map((d) => d.id_documento);
    await revisar(1, { accion: 'recarga', documentos: docs }).expect(201);
    const n = (
      await estudiante.get('/api/estudiante/notificaciones')
    ).body.notificaciones.find((n) => n.generado_por === 'funcionario');
    expect(n).toMatchObject({
      tipo: 'warning',
      titulo: 'Documentos por volver a subir',
    });
    expect(n.msg).toContain('Documento de identidad');
    expect(n.msg).toContain('Estampilla Pro-Cultura');
    expect(n.msg).not.toContain('Saber Pro');
    await revisar(1, { accion: 'recarga', documentos: [999] }).expect(400);
    await revisar(1, {
      accion: 'recarga',
      documentos: [docs[0], docs[0]],
    }).expect(400);
    await revisar(1, { accion: 'recarga', documentos: [] }).expect(400);
  });
  it('un rollback elimina también el aviso de la revisión', async () => {
    const id = await solicitud();
    await expect(
      base.servicio.transaction(async (client) => {
        await client.query(
          "INSERT INTO revisiones(id_solicitud,id_funcionario,resultado) VALUES($1,2,'APROBADA')",
          [id],
        );
        throw new Error('fallo posterior');
      }),
    ).rejects.toThrow('fallo posterior');
    expect(
      (await base.db.query('SELECT * FROM notificaciones')).rows,
    ).toHaveLength(0);
  });
  it.each([16, 15, 1, 0, -1])(
    'el aviso diario respeta la frontera de %i días y no se duplica',
    async (dias) => {
      await solicitud('BORRADOR');
      await base.db.query(
        "UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+$1::int",
        [dias],
      );
      await svc.generarRecordatorios();
      await svc.generarRecordatorios();
      const n = (await estudiante.get('/api/estudiante/notificaciones')).body
        .notificaciones;
      expect(n).toHaveLength(dias >= 0 && dias <= 15 ? 1 : 0);
      if (n.length)
        expect(n[0]).toMatchObject({
          titulo: 'Plazo por vencer',
          generado_por: 'system',
          tipo: 'warning',
          msg: `Te queda poco tiempo para presentar toda la documentación (${dias} ${dias === 1 ? 'día' : 'días'}).`,
        });
    },
  );
  it('genera un aviso distinto por día con los días restantes actualizados', async () => {
    await solicitud();
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_inicio='2026-10-01',fecha_fin='2026-10-20'",
    );
    await svc.generarRecordatorios(undefined, '2026-10-06');
    await svc.generarRecordatorios(undefined, '2026-10-07');
    const r = await base.db.query('SELECT msg FROM notificaciones ORDER BY id');
    expect(r.rows.map((n) => n.msg)).toEqual([
      'Te queda poco tiempo para presentar toda la documentación (14 días).',
      'Te queda poco tiempo para presentar toda la documentación (13 días).',
    ]);
  });
  it.each(['VALIDA', 'CERRADA'])(
    'no recuerda documentos a una solicitud %s',
    async (estado) => {
      await solicitud(estado);
      await base.db.exec(
        "UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+3",
      );
      await svc.generarRecordatorios();
      expect(
        (await base.db.query('SELECT * FROM notificaciones')).rows,
      ).toHaveLength(0);
    },
  );
  it('no inventa un plazo si no hay periodo y respeta el cierre administrativo', async () => {
    await solicitud();
    await base.db.exec('UPDATE solicitud_grado SET id_periodo=NULL');
    await svc.generarRecordatorios();
    await base.db.exec(
      "UPDATE solicitud_grado SET id_periodo='11111111-1111-4111-8111-111111111111'; UPDATE periodos_grado SET estado='CERRADO',fecha_fin=CURRENT_DATE+3",
    );
    await svc.generarRecordatorios();
    expect(
      (await base.db.query('SELECT * FROM notificaciones')).rows,
    ).toHaveLength(0);
  });
  it('marcar leída es persistente e idempotente y no permite tocar otra estudiante', async () => {
    await base.db.query(
      "SELECT crear_notificacion(1,'info','Propia','Mensaje','system','lectura')",
    );
    const ajena = await base.db.query(
      "SELECT crear_notificacion(999,'info','Ajena','Mensaje','system','lectura-ajena')::text AS id",
    );
    const id = (await estudiante.get('/api/estudiante/notificaciones')).body
      .notificaciones[0].id;
    await estudiante
      .patch(`/api/estudiante/notificaciones/${id}/leida`)
      .expect(200);
    await estudiante
      .patch(`/api/estudiante/notificaciones/${id}/leida`)
      .expect(200);
    await estudiante
      .patch(`/api/estudiante/notificaciones/${ajena.rows[0].id}/leida`)
      .expect(404);
    expect(
      (await estudiante.get('/api/estudiante/notificaciones')).body.noLeidas,
    ).toBe(0);
  });
  it.each([
    ['valid', 'Válido', 'success'],
    ['invalid', 'No válido', 'error'],
    ['inconsistent', 'Inconsistente', 'warning'],
    ['to_check', 'Por revisar', 'info'],
  ])(
    'cada resultado OCR %s produce un aviso por documento',
    async (clase, titulo, tipo) => {
      clasificacion = clase;
      await enviar().expect(201);
      const n = (await estudiante.get('/api/estudiante/notificaciones')).body
        .notificaciones;
      const ocr = n.filter((n) => n.generado_por === 'motor');
      expect(ocr).toHaveLength(4);
      expect(ocr.every((n) => n.titulo === titulo && n.tipo === tipo)).toBe(
        true,
      );
      expect(
        ocr.every((n) =>
          n.msg.includes(
            clase === 'valid'
              ? 'Documento verificado.'
              : 'El documento no corresponde al formato esperado.',
          ),
        ),
      ).toBe(true);
      expect(n.find((n) => n.generado_por === 'system').msg).toContain(
        'pendiente de integración',
      );
    },
  );
  it('el fallo del segundo documento revierte las notificaciones del primero', async () => {
    const impl = motor.getMockImplementation()!;
    motor
      .mockImplementationOnce(impl)
      .mockRejectedValueOnce(new Error('fallo de motor'));
    await enviar().expect(503);
    expect(
      (await base.db.query('SELECT * FROM notificaciones')).rows,
    ).toHaveLength(0);
    expect(
      (await base.db.query('SELECT * FROM validaciones')).rows,
    ).toHaveLength(0);
  });
  it('una corrección conserva avisos previos y su reintento idempotente no duplica', async () => {
    await enviar().expect(201);
    const d = (
      await base.db.query(
        "SELECT id_documento FROM documentos WHERE tipo_documento='identification'",
      )
    ).rows[0];
    const corregir = () =>
      estudiante
        .post('/api/solicitudes/1/correcciones')
        .field('ids', JSON.stringify([d.id_documento]))
        .field('clave', 'correccion-notificaciones')
        .attach('documentos', PDF, {
          filename: 'corregido.pdf',
          contentType: 'application/pdf',
        });
    clasificacion = 'valid';
    await corregir().expect(201);
    await corregir().expect(201);
    const n = (await estudiante.get('/api/estudiante/notificaciones')).body
      .notificaciones;
    expect(n).toHaveLength(6);
    expect(n[0].msg).toContain('Versión 2');
    expect(n[0].titulo).toBe('Válido');
  });
  it.skipIf(process.env.NOTIFICACIONES_UI_REAL !== '1')(
    'home con API y PostgreSQL reales: recibe actores y persiste la lectura',
    async () => {
      await enviar().expect(201);
      await base.db.exec(
        "UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+3",
      );
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
          '3004',
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
            throw new Error('El frontend no pudo iniciar.');
          try {
            if ((await fetchReal('http://127.0.0.1:3004')).ok) {
              listo = true;
              break;
            }
          } catch {
            /* espera de arranque */
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
        const contextoFuncionaria = await browser.newContext({ viewport: {width:1280,height:1000} });
        await contextoFuncionaria.request.post('http://127.0.0.1:3000/api/auth/login', {
          data: {username:'rmarriaga@utb.edu.co',password:'12345'},
        });
        const revision = await contextoFuncionaria.newPage();
        await revision.goto('http://127.0.0.1:3004/funcionario/dashboard');
        await revision.getByRole('link', {name:'Ver solicitud 1',exact:true}).first().click();
        await revision.getByLabel('Comentario (obligatorio)').fill('Revisa la información del formulario.');
        await revision.getByRole('button',{name:'Enviar comentario',exact:true}).click();
        await revision.getByRole('button',{name:'Confirmar acción',exact:true}).click();
        await revision.getByText('Acción registrada. La notificación del estudiante quedó guardada.',{exact:true}).waitFor();
        await revision.getByRole('combobox',{name:'Acción',exact:true}).selectOption('recarga');
        await revision.getByRole('checkbox').first().check();
        await revision.getByRole('button',{name:'Solicitar corrección',exact:true}).click();
        await revision.getByRole('button',{name:'Confirmar acción',exact:true}).click();
        await revision.getByText('Corrección solicitada',{exact:true}).waitFor();
        for (const accion of ['aceptada','anulada']) {
          const id = await solicitud();
          await revision.goto(`http://127.0.0.1:3004/funcionario/detalle_preinscripcion/${id}`);
          await revision.getByRole('combobox',{name:'Acción',exact:true}).selectOption(accion);
          await revision.getByRole('button',{name:accion==='aceptada'?'Aceptar solicitud':'Anular solicitud',exact:true}).click();
          await revision.getByRole('button',{name:'Confirmar acción',exact:true}).click();
          await revision.getByText(accion==='aceptada'?'Solicitud aceptada':'Solicitud anulada',{exact:true}).waitFor();
        }
        await contextoFuncionaria.close();
        const contexto = await browser.newContext({
          viewport: { width: 1280, height: 1000 },
        });
        const login = await contexto.request.post(
          'http://127.0.0.1:3000/api/auth/login',
          { data: { username: 'lizapata@utb.edu.co', password: '12345' } },
        );
        expect(login.status()).toBe(201);
        const pagina = await contexto.newPage();
        const respuesta = pagina.waitForResponse(
          (r) =>
            r.url() === 'http://127.0.0.1:3000/api/estudiante/notificaciones' &&
            r.request().method() === 'GET',
        );
        await pagina.goto('http://127.0.0.1:3004/estudiante/home');
        const cuerpo = await (await respuesta).json();
        expect(cuerpo.noLeidas).toBe(10);
        expect(cuerpo.notificaciones.filter((n: {generado_por:string}) => n.generado_por==='funcionario')).toHaveLength(4);
        const panel = pagina.getByRole('region', {
          name: 'Notificaciones',
          exact: true,
        });
        await panel
          .getByRole('button', { name: 'Ver todas las notificaciones' })
          .click();
        expect(await panel.getByRole('listitem').count()).toBe(10);
        await panel
          .getByRole('button', { name: /Marcar como leída/ })
          .first()
          .click();
        await pagina.waitForFunction(() =>
          document
            .querySelector('#notificaciones')
            ?.textContent?.includes('9 sin leer'),
        );
        expect(
          (await estudiante.get('/api/estudiante/notificaciones')).body
            .noLeidas,
        ).toBe(9);
        await pagina.reload();
        await pagina.waitForFunction(() =>
          document
            .querySelector('#notificaciones')
            ?.textContent?.includes('9 sin leer'),
        );
      } finally {
        await browser?.close();
        next.kill('SIGTERM');
      }
    },
    120000,
  );
});
