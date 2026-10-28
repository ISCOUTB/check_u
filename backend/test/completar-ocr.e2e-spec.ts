import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';
const fetchReal = globalThis.fetch;
const PDF = Buffer.from('%PDF-1.4\nPrueba sintética\n%%EOF');
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
  perfil: { tipoDocumento: 'CC', numeroDocumento: '1000000001' },
  segundoPrograma: false,
  programas: [
    {
      orden: 1,
      programa: 'Ingeniería',
      modalidad: 'PRESENCIAL',
      tipoOpcionGrado: 'TRABAJO_DE_GRADO',
    },
  ],
  pregrado: { conoceRegistroSaberPro: false },
};
function resultado(tipo: string, valido = false) {
  return {
    id_student: 'T00000001',
    type_document: tipo,
    document_version: 1,
    ...(tipo === 'estampilla_pro_cultura' ? { document_order: 1 } : {}),
    extracted_data: { code_student: { value: 'T00000001', confidence: 1 } },
    rules: [
      {
        rule: 'comprobacion_interna',
        result: valido ? 'cumple' : 'no_cumple',
        no_evaluable_reason: null,
        mandatory: true,
        message: valido
          ? 'Documento verificado.'
          : 'El documento no corresponde al formato esperado.',
        timestamp: '2026-10-27T03:00:00Z',
        errors: [],
      },
    ],
    errors: [],
    document_classification: valido ? 'valid' : 'invalid',
    validation_status: 'completed',
    validation_version: 'test@1',
    timestamp: '2026-10-27T03:00:00Z',
    resubmission_allowed: !valido,
    required_action: valido ? 'none' : 'upload_new_version',
    resubmission_reason: valido ? null : 'Corrige el documento.',
  };
}
describe('Tarea 38: progreso, PDF privado, correcciones versionadas y autorización', () => {
  let app: INestApplication<App>,
    base: Awaited<ReturnType<typeof crearDbBorrador>>,
    agente: ReturnType<typeof request.agent>,
    carpeta: string;
  let motor: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'checku38-'));
    process.env.DOCUMENTOS_TEMP_DIR = carpeta;
    base = await crearDbBorrador();
    await base.db.exec(
      `INSERT INTO periodos_grado (nombre,fecha_inicio,fecha_fin,fecha_graduacion) VALUES ('Prueba',CURRENT_DATE-1,CURRENT_DATE+30,CURRENT_DATE+60)`,
    );
    // La migración es repetible también en una base que ya dispone del nuevo esquema.
    await base.db.exec(
      await readFile(
        new URL(
          '../../db/migrations/005-reenvios-idempotentes.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    motor = vi.fn().mockImplementation(async (_url, opts) => {
      const f = opts.body as FormData;
      return new Response(
        JSON.stringify({
          id_student: 'T00000001',
          nivel: 'PREGRADO',
          estado_general: 'invalid',
          resultados: [resultado(f.get('tipos') as string)],
          errores: [],
        }),
      );
    });
    vi.stubGlobal('fetch', motor);
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    app = m.createNestApplication();
    app.setGlobalPrefix('api');
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
    vi.unstubAllGlobals();
    delete process.env.DOCUMENTOS_TEMP_DIR;
  });
  function inicial(stream = false) {
    let r = agente.post('/api/solicitudes/enviar');
    if (stream) r = r.set('Accept', 'application/x-ndjson');
    r = r.field('datos', JSON.stringify(DATOS)).field('tipos', TIPOS.join(','));
    for (const t of TIPOS)
      r = r.attach('documentos', PDF, {
        filename: t + '.pdf',
        contentType: 'application/pdf',
      });
    return r;
  }
  async function actual(tipo = 'identification') {
    return (
      await base.db.query(
        'SELECT * FROM documentos WHERE tipo_documento=$1 ORDER BY version DESC LIMIT 1',
        [tipo],
      )
    ).rows[0];
  }
  function corregir(
    id: number,
    clave = 'correccion-prueba-1',
    pdf = PDF,
    stream = false,
  ) {
    let r = agente.post('/api/solicitudes/1/correcciones');
    if (stream) r = r.set('Accept', 'application/x-ndjson');
    return r
      .field('ids', JSON.stringify([id]))
      .field('clave', clave)
      .attach('documentos', pdf, {
        filename: 'corregido.pdf',
        contentType: 'application/pdf',
      });
  }
  it('emite etapas del flujo real y 100 % solamente con resultado confirmado', async () => {
    const r = await inicial(true).expect(200);
    const eventos = r.text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const etapas = eventos.filter((e) => e.tipo === 'progreso');
    expect(etapas.map((e) => e.etapa)).toEqual([
      'Subiendo documentos.',
      'Documentos cargados.',
      'Registrando solicitud de preinscripción.',
      'Solicitud de preinscripción almacenada.',
      'Enviando documentos al motor de análisis documental.',
      'Verificando documento de identidad.',
      'Verificando evaluación de grado expedida por Banner.',
      'Verificando paz y salvo con Biblioteca (validación pendiente de integración).',
      'Verificando resultados Saber Pro.',
      'Verificando comprobante de estampilla.',
      'Generando análisis documental.',
      'Resultados listos. Redirigiendo…',
    ]);
    expect(etapas.slice(0, -1).every((e) => e.porcentaje < 100)).toBe(true);
    expect(etapas.at(-1).porcentaje).toBe(100);
    expect(eventos.at(-1).resultado.ok).toBe(true);
    expect(
      (await base.db.query('SELECT estado FROM solicitud_grado')).rows[0]
        .estado,
    ).toBe('EN_PROCESO');
  });
  it('entrega progreso por HTTP mientras el motor aún está trabajando', async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((r) => {
      liberar = r;
    });
    const impl = motor.getMockImplementation()!;
    motor.mockImplementationOnce(async (...args) => {
      await espera;
      return impl(...args);
    });
    await app.listen(0, '127.0.0.1');
    const direccion = app.getHttpServer().address();
    const url = `http://127.0.0.1:${typeof direccion === 'object' && direccion ? direccion.port : 0}/api`;
    const login = await fetchReal(url + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'lizapata@utb.edu.co',
        password: '12345',
      }),
    });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const form = new FormData();
    form.append('datos', JSON.stringify(DATOS));
    form.append('tipos', TIPOS.join(','));
    for (const t of TIPOS)
      form.append(
        'documentos',
        new Blob([new Uint8Array(PDF)], { type: 'application/pdf' }),
        t + '.pdf',
      );
    const res = await fetchReal(url + '/solicitudes/enviar', {
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/x-ndjson' },
      body: form,
    });
    const lector = res.body!.getReader();
    const decoder = new TextDecoder();
    let texto = '';
    try {
      while (!texto.includes('Verificando documento de identidad.')) {
        const p = await lector.read();
        if (p.done) break;
        texto += decoder.decode(p.value, { stream: true });
      }
      expect(texto).toContain('Verificando documento de identidad.');
      expect(texto).not.toContain('"porcentaje":100');
      expect(texto).not.toContain('Generando análisis');
      liberar();
      while (true) {
        const p = await lector.read();
        if (p.done) break;
        texto += decoder.decode(p.value, { stream: true });
      }
      expect(texto).toContain('"porcentaje":100');
      expect(texto).toContain('"tipo":"resultado"');
    } finally {
      liberar();
      await lector.cancel();
    }
  });
  it('una falla interrumpe el progreso sin éxito ni etapas posteriores', async () => {
    motor.mockRejectedValueOnce(new Error('ruta secreta'));
    const r = await inicial(true).expect(200);
    const eventos = r.text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'error',
      estado: 'error',
      codigo: 503,
    });
    expect(
      eventos.some((e) => e.porcentaje === 100 || e.tipo === 'resultado'),
    ).toBe(false);
    expect(r.text).not.toContain('ruta secreta');
    expect(r.text).not.toContain('Generando análisis');
    expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
      0,
    );
  });
  it('consulta el PDF auténtico con sesión, sin publicar rutas físicas; no permite otro propietario ni rol', async () => {
    await inicial().expect(201);
    const doc = await actual();
    const ruta = `/api/estudiante/documentos/${doc.id_documento}/original`;
    const r = await agente
      .get(ruta)
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    expect(r.body).toEqual(PDF);
    expect(r.headers['cache-control']).toContain('no-store');
    await request(app.getHttpServer()).get(ruta).expect(401);
    await base.db
      .exec(`INSERT INTO usuarios (id_usuario,nombres,apellidos,correo,rol,codigo_estudiante) VALUES (999,'Otra','Persona','otra@example.org','ESTUDIANTE','T99999999');
      UPDATE solicitud_grado SET id_estudiante=999 WHERE id_solicitud=1`);
    await agente.get(ruta).expect(404);
    const f = request.agent(app.getHttpServer());
    await f
      .post('/api/auth/login')
      .send({ username: 'rmarriaga@utb.edu.co', password: '12345' })
      .expect(201);
    await f.get(ruta).expect(403);
  });
  it('rechaza la vista previa vencida sin eliminar los resultados', async () => {
    await inicial().expect(201);
    const d = await actual();
    await base.db.exec(
      "UPDATE periodos_grado SET fecha_inicio=CURRENT_DATE-90,fecha_fin=((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date-16)",
    );
    const diagnostico = await base.db.query(
      "SELECT fecha_fin, CURRENT_TIMESTAMP AS ahora, ((fecha_fin+16)::timestamp AT TIME ZONE 'America/Bogota') > CURRENT_TIMESTAMP AS vigente FROM periodos_grado",
    );
    expect(diagnostico.rows[0].vigente, JSON.stringify(diagnostico.rows)).toBe(
      false,
    );
    await agente
      .get(`/api/estudiante/documentos/${d.id_documento}/original`)
      .expect(410);
    const r = await agente
      .get('/api/estudiante/solicitud/analisis')
      .expect(200);
    expect(r.body.documentos.every((d) => !d.archivoDisponible)).toBe(true);
    expect(r.body.documentos[0].analisis).toBeTruthy();
  });
  it('crea versión 2 en la misma solicitud y conserva archivos, resultados e historial de versión 1', async () => {
    await inicial().expect(201);
    const d = await actual();
    const r = await corregir(d.id_documento).expect(201);
    expect(r.body.id_solicitud).toBe(1);
    const nuevo = await actual();
    expect(nuevo.version).toBe(2);
    expect(nuevo.id_documento).not.toBe(d.id_documento);
    expect((await base.db.query('SELECT * FROM documentos')).rows).toHaveLength(
      6,
    );
    expect(
      (await base.db.query('SELECT * FROM historial_validaciones')).rows,
    ).toHaveLength(6);
    expect(await readdir(carpeta)).toHaveLength(6);
    await agente
      .get(`/api/estudiante/documentos/${d.id_documento}/original`)
      .expect(200);
    const consulta = await agente
      .get('/api/estudiante/solicitud/analisis')
      .expect(200);
    expect(
      consulta.body.documentos.find((d) => d.tipo === 'identification'),
    ).toMatchObject({
      id: String(nuevo.id_documento),
      version: 2,
      resubmission_allowed: true,
    });
    expect(consulta.body.politicaReenvios).toMatchObject({
      usados: 1,
      limite: 3,
    });
    expect(
      consulta.body.documentos.find((d) => d.tipo === 'identification').analisis
        .document_version,
    ).toBe(2);
    expect(
      consulta.body.documentos.find((d) => d.tipo === 'identification')
        .resultados[0].mensaje,
    ).toBe('El documento no corresponde al formato esperado.');
  });
  it('la clave idempotente no duplica análisis; rechaza cambiar archivos conservando la clave', async () => {
    await inicial().expect(201);
    const d = await actual();
    const primero = await corregir(d.id_documento).expect(201);
    const llamadas = motor.mock.calls.length;
    const segundo = await corregir(d.id_documento).expect(201);
    expect(segundo.body.id_entrega).toBe(primero.body.id_entrega);
    expect(motor).toHaveBeenCalledTimes(llamadas);
    await corregir(
      d.id_documento,
      'correccion-prueba-1',
      Buffer.from('%PDF-1.4 otro contenido'),
    ).expect(409);
  });
  it('aplica límite de tres reenvíos por día y permite reintentar una clave confirmada sin consumir cupo', async () => {
    await inicial().expect(201);
    let primero: number = 0;
    for (let i = 0; i < 3; i++) {
      const d = await actual();
      if (!i) primero = d.id_documento;
      await corregir(d.id_documento, `correccion-limite-${i}`).expect(201);
    }
    const d = await actual();
    await corregir(d.id_documento, 'correccion-limite-4').expect(409);
    await corregir(primero, 'correccion-limite-0').expect(201);
    const consulta = await agente
      .get('/api/estudiante/solicitud/analisis')
      .expect(200);
    expect(consulta.body.politicaReenvios.usados).toBe(3);
    expect(consulta.body.documentos.every((d) => !d.resubmission_allowed)).toBe(
      true,
    );
    await base.db.exec(
      "UPDATE entregas SET fecha_entrega_bogota=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date-1 WHERE tipo_entrega='CORRECCION'",
    );
    await corregir(d.id_documento, 'correccion-dia-nuevo').expect(201);
  });
  it('no permite reemplazar documentos válidos ni versiones antiguas', async () => {
    await inicial().expect(201);
    const d = await actual();
    await corregir(d.id_documento).expect(201);
    await corregir(d.id_documento, 'correccion-vieja').expect(409);
    const nuevo = await actual();
    await base.db.query(
      "UPDATE documentos SET estado='VALIDO' WHERE id_documento=$1",
      [nuevo.id_documento],
    );
    await corregir(nuevo.id_documento, 'correccion-valido').expect(403);
  });
  it('rechaza archivos ajenos a la solicitud y mantiene versión previa si falla el motor', async () => {
    await inicial().expect(201);
    await corregir(999).expect(409);
    const d = await actual();
    motor.mockRejectedValueOnce(new Error('caída'));
    await corregir(d.id_documento).expect(503);
    expect((await actual()).version).toBe(1);
    expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
      1,
    );
    expect(await readdir(carpeta)).toHaveLength(5);
  });
  it('un envío de varios documentos consume un solo reenvío y conserva el orden de cada estampilla', async () => {
    await inicial().expect(201);
    const id = await actual(),
      stamp = await actual('estampilla_pro_cultura');
    await agente
      .post('/api/solicitudes/1/correcciones')
      .field('ids', JSON.stringify([id.id_documento, stamp.id_documento]))
      .field('clave', 'correccion-multiple')
      .attach('documentos', PDF, {
        filename: 'id.pdf',
        contentType: 'application/pdf',
      })
      .attach('documentos', PDF, {
        filename: 'stamp.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(
      (await agente.get('/api/estudiante/solicitud/analisis')).body
        .politicaReenvios.usados,
    ).toBe(1);
  });
});
