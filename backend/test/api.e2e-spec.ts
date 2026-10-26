import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearMockDatabaseService } from './soporte/mock-db.js';

// La aplicación se arma igual que en main.ts (prefijo /api) para probar las rutas reales.
// Usa los usuarios de prueba fijos de AuthService (se reemplazan en la Tarea 13).
const ESTUDIANTE = { username: 'lizapata@utb.edu.co', password: '12345' };
const FUNCIONARIO = { username: 'rmarriaga@utb.edu.co', password: '12345' };
const USUARIO_ESTUDIANTE = {
  id: 1,
  username: 'lizapata@utb.edu.co',
  name: 'Lisandro Zapata',
  role: 'estudiante',
};

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let mockDb: ReturnType<typeof crearMockDatabaseService>;

  beforeEach(async () => {
    mockDb = crearMockDatabaseService();

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(mockDb)
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health y Auth', () => {
    it('GET /api/health responde que el servicio está arriba', () => {
      return request(app.getHttpServer()).get('/api/health').expect(200).expect({
        status: 'ok',
        service: 'CheckU API',
        message: 'Backend conectado correctamente',
      });
    });

    it('POST /api/auth/login con credenciales válidas devuelve el usuario y la cookie de sesión', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(ESTUDIANTE)
        .expect(201);

      expect(respuesta.body).toEqual({ user: USUARIO_ESTUDIANTE });
      const cookie = String(respuesta.headers['set-cookie']);
      expect(cookie).toMatch(/checku\.sid=[0-9a-f]{64};/);
      expect(cookie).toContain('HttpOnly');
    });

    it('POST /api/auth/login con contraseña incorrecta responde 401 sin cookie', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ ...ESTUDIANTE, password: 'otra' })
        .expect(401);

      expect(respuesta.headers['set-cookie']).toBeUndefined();
    });

    it('GET /api/auth/me sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('GET /api/auth/me con la cookie de sesión devuelve el usuario', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);

      await agente.get('/api/auth/me').expect(200).expect({ user: USUARIO_ESTUDIANTE });
    });

    it('POST /api/auth/logout cierra la sesión: después /me responde 401', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);

      await agente
        .post('/api/auth/logout')
        .expect(201)
        .expect({ message: 'Sesión cerrada correctamente' });
      await agente.get('/api/auth/me').expect(401);
    });
  });

  describe('Solicitudes y Preinscripción (Tarea 29)', () => {
    it('POST /api/solicitudes/enviar sin sesión responde 401', () => {
      return request(app.getHttpServer()).post('/api/solicitudes/enviar').expect(401);
    });

    it('POST /api/solicitudes/enviar con rol funcionario responde 403', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(FUNCIONARIO).expect(201);

      await agente.post('/api/solicitudes/enviar').expect(403);
    });

    it('POST /api/solicitudes/enviar registra formalmente la entrega, vincula documentos y actualiza a EN_PROCESO', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);

      // Verificamos estado inicial antes del envío
      expect(mockDb.estado.solicitudes[0].estado).toBe('BORRADOR');
      expect(mockDb.estado.entregas).toHaveLength(0);
      expect(mockDb.estado.documentos.every((d) => d.id_entrega === null && d.estado === 'CARGADO')).toBe(true);

      const respuesta = await agente
        .post('/api/solicitudes/enviar')
        .send({ claveIdempotencia: 'idem-test-123' })
        .expect(201);

      expect(respuesta.body).toEqual({
        ok: true,
        id_solicitud: 1,
        id_entrega: 1,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      });

      // Trazabilidad de entregas en BD: registro creado con tipo INICIAL y numero 1
      expect(mockDb.estado.entregas).toHaveLength(1);
      expect(mockDb.estado.entregas[0]).toEqual({
        id_entrega: 1,
        id_solicitud: 1,
        numero_entrega: 1,
        tipo_entrega: 'INICIAL',
      });

      // Documentos vinculados a id_entrega 1 y en estado POR_VALIDAR
      expect(mockDb.estado.documentos.every((d) => d.id_entrega === 1 && d.estado === 'POR_VALIDAR')).toBe(true);

      // Solicitud en estado EN_PROCESO
      expect(mockDb.estado.solicitudes[0].estado).toBe('EN_PROCESO');
    });

    it('Inmutabilidad post-envío: POST /api/solicitudes/borrador responde 409 cuando la solicitud está en EN_PROCESO', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);

      // Enviamos la preinscripción
      await agente.post('/api/solicitudes/enviar').expect(201);

      // Intentar editar borrador tras envío debe ser rechazado
      const respuesta = await agente
        .post('/api/solicitudes/borrador')
        .send({ perfil: { numeroDocumento: '12345' } })
        .expect(409);

      expect(respuesta.body.message).toContain('La preinscripción ya fue enviada');
    });

    it('Reintento de envío: POST /api/solicitudes/enviar responde 409 si ya no está en BORRADOR', async () => {
      const agente = request.agent(app.getHttpServer());
      await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);

      // Primer envío exitoso
      await agente.post('/api/solicitudes/enviar').expect(201);

      // Segundo envío rechazado
      await agente.post('/api/solicitudes/enviar').expect(409);
    });
  });
});

// Tarea 28: las rutas usan el esquema SQL real, incluyendo restricciones y rollback.
describe('Borrador de solicitud (Tarea 28, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let base: Awaited<
    ReturnType<typeof import('./soporte/db-borrador.js').crearDbBorrador>
  >;
  let agente: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    const { crearDbBorrador } = await import('./soporte/db-borrador.js');
    base = await crearDbBorrador();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agente = request.agent(app.getHttpServer());
    await agente.post('/api/auth/login').send(ESTUDIANTE).expect(201);
  });
  afterEach(async () => {
    await app?.close();
    await base?.db.close();
  });

  it('protege GET y POST por sesión y rol', async () => {
    for (const metodo of ['get', 'post'] as const) {
      await request(app.getHttpServer())
        [metodo]('/api/solicitudes/borrador')
        .expect(401);
    }
    const funcionario = request.agent(app.getHttpServer());
    await funcionario.post('/api/auth/login').send(FUNCIONARIO).expect(201);
    await funcionario.get('/api/solicitudes/borrador').expect(403);
    await funcionario.post('/api/solicitudes/borrador').send({}).expect(403);
  });

  it('crea un borrador vacío sin datos ficticios, documentos ni entregas', async () => {
    await agente
      .get('/api/solicitudes/borrador')
      .expect(200)
      .expect({ ok: true, id_solicitud: null, estado: null, borrador: null });
    const res = await agente
      .post('/api/solicitudes/borrador')
      .send({ nivel: 'PREGRADO', perfil: {} })
      .expect(201);
    expect(res.body).toMatchObject({
      ok: true,
      estado: 'BORRADOR',
      mensaje: 'Borrador guardado exitosamente',
    });
    expect(res.body.id_solicitud).toBeGreaterThan(0);
    expect(
      (await base.db.query('SELECT numero_documento FROM perfil_estudiante'))
        .rows,
    ).toEqual([]);
    for (const tabla of ['documentos', 'entregas', 'validaciones']) {
      expect((await base.db.query(`SELECT * FROM ${tabla}`)).rows).toHaveLength(
        0,
      );
    }
  });

  it('guarda campos parciales, conserva respuestas null y los restaura sin crear duplicados', async () => {
    const primero = await agente
      .post('/api/solicitudes/borrador')
      .send({
        nivel: 'PREGRADO',
        id_estudiante: 2,
        perfil: { ciudad: 'Cartagena' },
        programas: [
          { orden: 1, programa: 'Ingeniería de Sistemas', modalidad: '' },
        ],
        pregrado: {
          conoceRegistroSaberPro: true,
          numeroRegistroSaberPro: '',
          esEmpleadoUtb: null,
        },
      })
      .expect(201);
    const segundo = await agente
      .post('/api/solicitudes/borrador')
      .send({ perfil: { numeroDocumento: 'ABC123' } })
      .expect(201);
    expect(segundo.body.id_solicitud).toBe(primero.body.id_solicitud);
    const recuperado = await agente
      .get('/api/solicitudes/borrador')
      .expect(200);
    expect(recuperado.body.borrador.perfil).toMatchObject({
      numeroDocumento: 'ABC123',
      ciudad: 'Cartagena',
      tipoDocumento: null,
    });
    expect(recuperado.body.borrador.pregrado).toMatchObject({
      conoceRegistroSaberPro: true,
      numeroRegistroSaberPro: null,
      esEmpleadoUtb: null,
    });
    expect(recuperado.body.borrador.programas[0]).toMatchObject({
      programa: 'Ingeniería de Sistemas',
      modalidad: null,
    });
    expect(
      (await base.db.query('SELECT id_estudiante FROM solicitud_grado')).rows,
    ).toEqual([{ id_estudiante: 1 }]);
    expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
      0,
    );
  });

  it('actualiza el nivel respetando los triggers y elimina programas y experiencias retirados', async () => {
    await agente
      .post('/api/solicitudes/borrador')
      .send({
        nivel: 'PREGRADO',
        pregrado: { esEmpleadoUtb: false },
        programas: [
          { orden: 1, programa: 'Sistemas', tipoOpcionGrado: 'TRABAJO' },
        ],
      })
      .expect(201);
    await agente
      .post('/api/solicitudes/borrador')
      .send({
        nivel: 'POSGRADO',
        segundoPrograma: true,
        programas: [
          { orden: 1, programa: 'Maestría' },
          { orden: 2, programa: 'Especialización' },
        ],
        posgrado: { tituloObtenido: 'Ingeniería' },
        experiencia: [
          { orden: 1, empresa: 'Empresa A' },
          { orden: 2, cargo: 'Desarrollo' },
        ],
      })
      .expect(201);
    expect(
      (await base.db.query('SELECT * FROM informacion_pregrado')).rows,
    ).toHaveLength(0);
    await agente
      .post('/api/solicitudes/borrador')
      .send({ segundoPrograma: false, experiencia: [] })
      .expect(201);
    const res = await agente.get('/api/solicitudes/borrador').expect(200);
    expect(res.body.borrador.nivel).toBe('POSGRADO');
    expect(res.body.borrador.programas).toHaveLength(1);
    expect(res.body.borrador.programas[0].tipoOpcionGrado).toBeNull();
    expect(res.body.borrador.posgrado.tituloObtenido).toBe('Ingeniería');
    expect(res.body.borrador.experiencia).toHaveLength(0);
  });

  it('asocia metadatos CARGADO al borrador con id_entrega NULL', async () => {
    const documento = {
      id: 'identification',
      nombre: 'cedula.pdf',
      tamano: 1234,
    };
    await agente
      .post('/api/solicitudes/borrador')
      .send({ documentos: { identification: documento } })
      .expect(201);
    await agente
      .post('/api/solicitudes/borrador')
      .send({ documentos: { identification: documento } })
      .expect(201);
    const docs = await base.db.query(
      'SELECT id_entrega, estado FROM documentos',
    );
    expect(docs.rows).toEqual([{ id_entrega: null, estado: 'CARGADO' }]);
    const res = await agente.get('/api/solicitudes/borrador').expect(200);
    expect(res.body.borrador.documentos.identification).toEqual(documento);
    expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
      0,
    );
  });

  it('restaura fechas calendario y permite borrar textos ya diligenciados', async () => {
    await agente
      .post('/api/solicitudes/borrador')
      .send({
        perfil: { fechaNacimiento: '2000-01-02', ciudad: 'Cartagena' },
        pregrado: {
          conoceRegistroSaberPro: true,
          numeroRegistroSaberPro: 'EK123',
          fechaExamenSaberPro: '2026-08-20',
        },
      })
      .expect(201);
    await agente
      .post('/api/solicitudes/borrador')
      .send({ perfil: { ciudad: '' } })
      .expect(201);
    const res = await agente.get('/api/solicitudes/borrador').expect(200);
    expect(res.body.borrador.perfil).toMatchObject({
      fechaNacimiento: '2000-01-02',
      ciudad: null,
    });
    expect(res.body.borrador.pregrado.fechaExamenSaberPro).toBe('2026-08-20');
  });

  it('Tarea 33: devuelve un campo inválido sin reflejar valores personales', async () => {
    const res = await agente.post('/api/solicitudes/borrador')
      .send({ perfil: { numeroDocumento: 'DATO PRIVADO!' } }).expect(400);
    expect(res.body).toMatchObject({ codigo: 'BORRADOR_DATOS_INVALIDOS', campos: [{ campo: 'perfil.numeroDocumento', motivo: 'INVALIDO' }] });
    expect(res.body.message).toContain('el número de documento de identidad');
    expect(JSON.stringify(res.body)).not.toContain('DATO PRIVADO!');
  });

  it('Tarea 33: traduce una restricción NOT NULL real sin exponer SQL', async () => {
    // Emula un esquema institucional que aún exige el tipo de documento.
    await base.db.exec('ALTER TABLE perfil_estudiante ALTER COLUMN tipo_documento_identidad SET NOT NULL');
    const res = await agente.post('/api/solicitudes/borrador')
      .send({ perfil: { numeroDocumento: 'ABC123' } }).expect(400);
    expect(res.body.codigo).toBe('BORRADOR_CAMPO_REQUERIDO');
    expect(res.body.message).toContain('falta completar el tipo de documento de identidad');
    expect(JSON.stringify(res.body)).not.toMatch(/23502|INSERT|perfil_estudiante/);
    expect((await base.db.query('SELECT * FROM solicitud_grado')).rows).toHaveLength(0);
  });

  it('Tarea 33: describe una identidad duplicada y conserva la transacción anterior', async () => {
    await base.db.exec("INSERT INTO perfil_estudiante(id_usuario,tipo_documento_identidad,numero_documento) VALUES(2,'CC','ABC123')");
    const res = await agente.post('/api/solicitudes/borrador')
      .send({ perfil: { tipoDocumento: 'CC', numeroDocumento: 'ABC123' } }).expect(409);
    expect(res.body.codigo).toBe('BORRADOR_IDENTIDAD_REPETIDA');
    expect(res.body.message).toContain('ya está registrado');
    expect(JSON.stringify(res.body)).not.toMatch(/23505|INSERT|uq_perfil/);
    expect((await base.db.query('SELECT * FROM solicitud_grado')).rows).toHaveLength(0);
  });

  it('rechaza datos mal formados antes de persistir', async () => {
    for (const payload of [
      { nivel: 'OTRO' },
      { perfil: { fechaNacimiento: '2026-02-31' } },
      { programas: [{ orden: 3 }] },
      { pregrado: { esEmpleadoUtb: 'false' } },
    ]) {
      await agente.post('/api/solicitudes/borrador').send(payload).expect(400);
    }
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
  });

  it('revierte toda la transacción si falla un documento', async () => {
    await agente
      .post('/api/solicitudes/borrador')
      .send({
        perfil: { ciudad: 'Cartagena' },
        documentos: [{ id: 'invalido', nombre: 'archivo.pdf', tamano: 10 }],
      })
      .expect(400);
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
    expect(
      (await base.db.query('SELECT * FROM perfil_estudiante')).rows,
    ).toHaveLength(0);
  });

  it('conserva intactas las solicitudes enviadas y no devuelve sus formularios como borrador', async () => {
    await base.db.exec(
      "INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado) VALUES(1,'PREGRADO','EN_PROCESO')",
    );
    const antes = (await base.db.query('SELECT * FROM solicitud_grado')).rows;
    await agente
      .post('/api/solicitudes/borrador')
      .send({ perfil: { ciudad: 'Otra' } })
      .expect(409);
    const res = await agente.get('/api/solicitudes/borrador').expect(200);
    expect(res.body.borrador).toBeNull();
    expect(res.body.estado).toBe('EN_PROCESO');
    expect((await base.db.query('SELECT * FROM solicitud_grado')).rows).toEqual(
      antes,
    );
  });
});
