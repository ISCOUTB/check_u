import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { configurarSeguridadHttp } from '../src/seguridad-http.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const LOCAL = 'http://localhost:3001';
const EXTERNO = 'https://checku.iscoutb.dev.atacante.example';
const ESTUDIANTE = {
  username: 'estudiante@f10.example',
  password: 'prueba-f10-estudiante',
};
const FUNCIONARIA = {
  username: 'funcionaria@f10.example',
  password: 'prueba-f10-funcionaria',
};

describe('F10: seguridad HTTP con la configuración del arranque real', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>;
  let app: NestExpressApplication;
  const apps: NestExpressApplication[] = [];
  async function crearApp() {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    const instancia = modulo.createNestApplication<NestExpressApplication>();
    apps.push(instancia);
    instancia.setGlobalPrefix('api');
    configurarSeguridadHttp(instancia);
    await instancia.init();
    return instancia;
  }

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_INIT', 'ENV');
    vi.stubEnv('AUTH_ESTUDIANTE_USERNAME', ESTUDIANTE.username);
    vi.stubEnv('AUTH_ESTUDIANTE_PASSWORD', ESTUDIANTE.password);
    vi.stubEnv('AUTH_FUNCIONARIO_USERNAME', FUNCIONARIA.username);
    vi.stubEnv('AUTH_FUNCIONARIO_PASSWORD', FUNCIONARIA.password);
    vi.stubEnv('CHECKU_FRONTEND_ORIGIN', '');
    vi.stubEnv('CHECKU_TRUST_PROXY_HOPS', '0');
    base = await crearDbBorrador();
    app = await crearApp();
  }, 30000);

  afterAll(async () => {
    await Promise.all(apps.map((instancia) => instancia.close()));
    await base?.db.close();
    vi.unstubAllEnvs();
  });

  it('aplica Helmet a las respuestas y permite el preflight del portal', async () => {
    const api = request(app.getHttpServer());
    const res = await api.get('/api/health').expect(200);
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    });
    expect(res.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();

    const preflight = () =>
      api
        .options('/api/auth/login')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
    await preflight()
      .set('Origin', LOCAL)
      .expect('Access-Control-Allow-Origin', LOCAL)
      .expect('Access-Control-Allow-Credentials', 'true')
      .expect(204);
    const ajeno = await preflight().set('Origin', EXTERNO).expect(204);
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rechaza login y logout de origen no autorizado, nulo o ausente', async () => {
    const api = request.agent(app.getHttpServer());
    for (const origen of [EXTERNO, 'null', undefined]) {
      const intento = api.post('/api/auth/login').send(ESTUDIANTE);
      if (origen) intento.set('Origin', origen);
      const res = await intento.expect(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    const login = await api
      .post('/api/auth/login')
      .set('Origin', LOCAL)
      .send(ESTUDIANTE)
      .expect('Cache-Control', 'private, no-store')
      .expect(201);
    const cookie = login.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=1800/i);
    expect(cookie).not.toMatch(/; Secure(?:;|$)/i);

    await api.post('/api/auth/logout').set('Origin', EXTERNO).expect(403);
    await api.post('/api/auth/logout').expect(403);
    await api.get('/api/auth/me').expect(200);
    await api.post('/api/auth/logout').set('Origin', LOCAL).expect(201);
    await api.get('/api/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'checku.sid=%FF')
      .expect(401);
  });

  it('protege PATCH con sesión y deja intacto el aviso rechazado', async () => {
    const api = request.agent(app.getHttpServer());
    await api
      .post('/api/auth/login')
      .set('Origin', LOCAL)
      .send(ESTUDIANTE)
      .expect(201);
    const {
      rows: [aviso],
    } = await base.db.query<{ id: string }>(
      "INSERT INTO notificaciones(estudiante_id,tipo,titulo,msg,generado_por,clave_evento) VALUES(1,'info','F10','Prueba','system','f10-prueba') RETURNING id::text",
    );
    const ruta = `/api/estudiante/notificaciones/${aviso.id}/leida`;
    await api.patch(ruta).set('Origin', EXTERNO).expect(403);
    await api.patch(ruta).expect(403);
    expect(
      (
        await base.db.query('SELECT leida FROM notificaciones WHERE id=$1', [
          aviso.id,
        ])
      ).rows[0].leida,
    ).toBe(false);
    await request(app.getHttpServer())
      .patch(ruta)
      .set('Origin', LOCAL)
      .expect(401);
    await api.patch(ruta).set('Origin', LOCAL).expect(200);
    expect(
      (
        await base.db.query('SELECT leida FROM notificaciones WHERE id=$1', [
          aviso.id,
        ])
      ).rows[0].leida,
    ).toBe(true);
  });

  it('rechaza multipart externo antes de guardar y admite el CSV legítimo', async () => {
    const api = request.agent(app.getHttpServer());
    await api
      .post('/api/auth/login')
      .set('Origin', LOCAL)
      .send(FUNCIONARIA)
      .expect(201);
    const correo = 'csv-f10@example.test';
    const cargar = () =>
      api
        .post('/api/funcionario/estudiantes/importar')
        .attach(
          'archivo',
          Buffer.from(
            `nombres;apellidos;codigo_estudiantil;correo;rol\nPrueba;Seguridad;T00999000;${correo};ESTUDIANTE\n`,
          ),
          'estudiantes.csv',
        );
    const buscar = () =>
      base.db.query('SELECT id_usuario FROM usuarios WHERE correo=$1', [
        correo,
      ]);
    await cargar().set('Origin', EXTERNO).expect(403);
    await cargar().expect(403);
    expect((await buscar()).rows).toHaveLength(0);
    await cargar().set('Origin', LOCAL).expect(200);
    expect((await buscar()).rows).toHaveLength(1);
  });

  it('limita login a cinco intentos por IP y no acepta X-Forwarded-For sin proxy configurado', async () => {
    const instancia = await crearApp();
    const api = request(instancia.getHttpServer());
    const login = (ip: string, password: string) =>
      api
        .post('/api/auth/login')
        .set('Origin', LOCAL)
        .set('X-Forwarded-For', ip)
        .send({ username: ESTUDIANTE.username, password });
    for (let i = 1; i <= 5; i++) {
      await login(`192.0.2.${i}`, 'incorrecta').expect(401);
    }
    const limitado = await login('192.0.2.6', ESTUDIANTE.password).expect(429);
    expect(Number(limitado.headers['retry-after'])).toBeGreaterThan(0);
    expect(limitado.headers['set-cookie']).toBeUndefined();
    await api.get('/api/health').expect(200);
  });

  it('distingue clientes detrás de un salto confiable y usa el extremo derecho de la cadena', async () => {
    vi.stubEnv('CHECKU_TRUST_PROXY_HOPS', '1');
    try {
      const instancia = await crearApp();
      const api = request(instancia.getHttpServer());
      const login = (cadena: string, password: string) =>
        api
          .post('/api/auth/login')
          .set('Origin', LOCAL)
          .set('X-Forwarded-For', cadena)
          .send({ username: ESTUDIANTE.username, password });
      for (let i = 1; i <= 5; i++) {
        await login(`198.51.100.${i}, 192.0.2.10`, 'incorrecta').expect(401);
      }
      await login('198.51.100.6, 192.0.2.10', ESTUDIANTE.password).expect(429);
      await login('192.0.2.11', ESTUDIANTE.password).expect(201);
    } finally {
      vi.stubEnv('CHECKU_TRUST_PROXY_HOPS', '0');
    }
  });

  it('usa HTTPS para la cookie y HSTS en producción y rechaza el origen de desarrollo', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CHECKU_FRONTEND_ORIGIN', 'https://portal.example.test');
    try {
      const instancia = await crearApp();
      const api = request(instancia.getHttpServer());
      const login = (origen: string) =>
        api.post('/api/auth/login').set('Origin', origen).send(ESTUDIANTE);
      await login(LOCAL).expect(403);
      const res = await login('https://portal.example.test')
        .expect('Access-Control-Allow-Origin', 'https://portal.example.test')
        .expect('Strict-Transport-Security', 'max-age=31536000')
        .expect(201);
      const cookie = res.get('Set-Cookie')?.[0] ?? '';
      expect(cookie).toMatch(/; Secure(?:;|$)/i);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      const salida = await api
        .post('/api/auth/logout')
        .set('Origin', 'https://portal.example.test')
        .set('Cookie', cookie.split(';')[0])
        .expect(201);
      expect(salida.get('Set-Cookie')?.[0]).toMatch(/; Secure(?:;|$)/i);
    } finally {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CHECKU_FRONTEND_ORIGIN', '');
    }
  });
});
