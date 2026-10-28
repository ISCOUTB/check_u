import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PoolClient } from 'pg';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { buscarPeriodoElegible } from '../src/periodos/asignacion-periodo.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const LOGIN = { username: 'lizapata@utb.edu.co', password: '12345' };
const ID = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const RUTA = '/api/solicitudes/borrador';

describe('Tarea 35: asignación de periodo con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>;
  let app: INestApplication<App>;
  let agente: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    base = await crearDbBorrador();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T17:00:00Z'));
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agente = request.agent(app.getHttpServer());
    await agente.post('/api/auth/login').send(LOGIN).expect(201);
  }, 30000);
  afterEach(async () => {
    await app?.close();
    await base?.db.close();
    vi.useRealTimers();
  });
  async function periodo(
    id = ID,
    inicio = '2026-11-01',
    fin = '2026-11-30',
    estado = 'ABIERTO',
  ) {
    await base.db.query(
      `INSERT INTO periodos_grado
      (id, nombre, fecha_inicio, fecha_fin, fecha_graduacion, estado)
      VALUES ($1, $2, $3, $4, $4, $5)`,
      [id, `Periodo ${id.slice(0, 1)}`, inicio, fin, estado],
    );
  }
  it('consulta sin crear; primer guardado persiste FK y próximos periodos informativos', async () => {
    await periodo();
    await periodo(OTRO, '2027-02-01', '2027-02-28');
    const consulta = await agente.get(RUTA).expect(200);
    expect(consulta.body.periodos).toMatchObject({
      fechaActual: '2026-11-22',
      periodoAsignado: null,
      periodoDisponible: { id: ID, fechaCorte: '2026-11-23' },
      proximosPeriodos: [{ id: OTRO }],
    });
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
    const guardado = await agente
      .post(RUTA)
      .send({ nivel: 'PREGRADO', id_periodo: OTRO })
      .expect(201);
    expect(guardado.body.periodos.periodoAsignado.id).toBe(ID);
    expect(
      (await base.db.query('SELECT id_periodo FROM solicitud_grado')).rows,
    ).toEqual([{ id_periodo: ID }]);
    expect((await base.db.query('SELECT * FROM entregas')).rows).toHaveLength(
      0,
    );
  });
  it.each(['2026-11-01', '2026-11-22'])(
    'es elegible el %s, incluido el día de inicio',
    async (fecha) => {
      await periodo();
      const seleccionado = await buscarPeriodoElegible(
        base.servicio as unknown as PoolClient,
        fecha,
      );
      expect(seleccionado?.id).toBe(ID);
    },
  );
  it.each([
    '2026-11-23',
    '2026-11-29',
    '2026-11-30',
    '2026-12-01',
    '2026-10-31',
  ])('no es elegible el %s', async (fecha) => {
    await periodo();
    expect(
      await buscarPeriodoElegible(
        base.servicio as unknown as PoolClient,
        fecha,
      ),
    ).toBeNull();
  });
  it('día de corte sin otro vigente: rechaza y revierte toda escritura', async () => {
    await periodo();
    vi.setSystemTime(new Date('2026-11-23T05:00:00Z'));
    await agente.post('/api/auth/login').send(LOGIN).expect(201);
    const res = await agente
      .post(RUTA)
      .send({ nombres: 'No persistir', nivel: 'PREGRADO' })
      .expect(409);
    expect(res.body.codigo).toBe('SIN_PERIODO_DISPONIBLE');
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
    expect(
      (await base.db.query('SELECT nombres FROM usuarios WHERE id_usuario = 1'))
        .rows[0],
    ).toEqual({ nombres: 'Lisandro' });
  });
  it('conserva asignación después del corte, cierre manual y edición de fechas', async () => {
    await periodo();
    const primero = await agente
      .post(RUTA)
      .send({ nivel: 'PREGRADO' })
      .expect(201);
    await periodo(OTRO, '2026-11-15', '2027-01-31');
    await base.db.query(
      "UPDATE periodos_grado SET estado = 'CERRADO', fecha_fin = '2026-11-22' WHERE id = $1",
      [ID],
    );
    vi.setSystemTime(new Date('2026-12-01T17:00:00Z'));
    await agente.post('/api/auth/login').send(LOGIN).expect(201);
    const consulta = await agente.get(RUTA).expect(200);
    expect(consulta.body.periodos.periodoAsignado).toMatchObject({
      id: ID,
      estado: 'CERRADO',
      fechaFin: '2026-11-22',
    });
    const segundo = await agente
      .post(RUTA)
      .send({ perfil: { ciudad: 'Cartagena' }, id_periodo: OTRO })
      .expect(201);
    expect(segundo.body.id_solicitud).toBe(primero.body.id_solicitud);
    expect(segundo.body.periodos.periodoAsignado.id).toBe(ID);
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(1);
  });
  it('un futuro no se asigna; cerrados no aparecen como próximos', async () => {
    await periodo(ID, '2026-12-01', '2026-12-30');
    await periodo(OTRO, '2027-02-01', '2027-02-28', 'CERRADO');
    const consulta = await agente.get(RUTA).expect(200);
    expect(consulta.body.periodos).toMatchObject({
      periodoAsignado: null,
      periodoDisponible: null,
      proximosPeriodos: [{ id: ID }],
    });
    await agente.post(RUTA).send({ nivel: 'POSGRADO' }).expect(409);
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
  });
  it('sin periodos responde estado informativo y error controlado al guardar', async () => {
    const consulta = await agente.get(RUTA).expect(200);
    expect(consulta.body.periodos).toMatchObject({
      periodoAsignado: null,
      periodoDisponible: null,
      proximosPeriodos: [],
    });
    await agente.post(RUTA).send({}).expect(409);
  });
  it('respeta cierre administrativo aunque las fechas sean vigentes', async () => {
    await periodo(ID, '2026-11-01', '2026-11-30', 'CERRADO');
    await agente.post(RUTA).send({}).expect(409);
  });
  it('desempata periodos solapados por inicio, fin e identificador', async () => {
    await periodo(OTRO);
    await periodo(ID);
    const res = await agente.post(RUTA).send({ nivel: 'POSGRADO' }).expect(201);
    expect(res.body.periodos.periodoAsignado.id).toBe(ID);
  });
  it('asigna una sola vez a un borrador histórico sin periodo', async () => {
    await periodo();
    await base.db.exec(
      "INSERT INTO solicitud_grado (id_estudiante, tipo_solicitud) VALUES (1, 'POSGRADO')",
    );
    const res = await agente.post(RUTA).send({ nivel: 'POSGRADO' }).expect(201);
    expect(res.body.periodos.periodoAsignado.id).toBe(ID);
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(1);
  });
  it('no permite saltarse la asignación enviando directamente sin periodo vigente', async () => {
    await agente
      .post('/api/solicitudes/enviar')
      .send({ nivel: 'PREGRADO', id_periodo: ID })
      .expect(409);
    expect(
      (await base.db.query('SELECT * FROM solicitud_grado')).rows,
    ).toHaveLength(0);
  });
  it('el esquema rechaza fechas inconsistentes', async () => {
    await expect(periodo(ID, '2026-12-01', '2026-11-01')).rejects.toThrow();
  });
  it('evalúa el corte según Bogotá incluso si UTC ya cambió de día', async () => {
    await periodo();
    vi.setSystemTime(new Date('2026-11-23T04:59:59Z'));
    await agente.post('/api/auth/login').send(LOGIN).expect(201);
    const res = await agente.post(RUTA).send({}).expect(201);
    expect(res.body.periodos.periodoAsignado.id).toBe(ID);
  });
  it('el periodo se consulta solamente después de autenticar al estudiante', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(401);
    const funcionario = request.agent(app.getHttpServer());
    await funcionario
      .post('/api/auth/login')
      .send({ username: 'rmarriaga@utb.edu.co', password: '12345' });
    await funcionario.get(RUTA).expect(403);
  });
});
