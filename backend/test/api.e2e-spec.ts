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
