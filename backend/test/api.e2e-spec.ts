import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

// La aplicación se arma igual que en main.ts (prefijo /api) para probar las rutas reales.
// Usa los usuarios de prueba fijos de AuthService (se reemplazan en la Tarea 13).
const ESTUDIANTE = { username: 'lizapata@utb.edu.co', password: '12345' };
const USUARIO_ESTUDIANTE = {
  id: 1,
  username: 'lizapata@utb.edu.co',
  name: 'Lisandro Zapata',
  role: 'estudiante',
};

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

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
