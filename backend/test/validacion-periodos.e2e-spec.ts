import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PeriodosModule } from '../src/periodos/periodos.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';
const RUTA = '/api/periodos-grado';
const DATOS = {
  nombre: 'Convocatoria',
  fechaInicio: '2026-10-23',
  fechaFin: '2026-11-30',
  fechaGraduacion: '2026-12-05',
  estado: 'ABIERTO',
};
const migracion = () =>
  readFile(
    new URL('../../db/migrations/009-validacion-periodos.sql', import.meta.url),
    'utf8',
  );
describe('Tarea 44a: validación HTTP y PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>,
    app: INestApplication<App>,
    agente: ReturnType<typeof request.agent>;
  let barrera: (() => Promise<void>) | null = null,
    conflictosSql = 0;
  beforeAll(async () => {
    base = await crearDbBorrador();
    const db = {
      ...base.servicio,
      async query(sql: string, params?: unknown[]) {
        try {
          const r = await base.servicio.query(sql, params);
          if (barrera && sql.startsWith('SELECT id FROM periodos_grado'))
            await barrera();
          return r;
        } catch (error) {
          if (
            typeof error === 'object' &&
            error &&
            'code' in error &&
            error.code === '23505'
          )
            conflictosSql++;
          throw new ServiceUnavailableException(
            'Error en el servicio de base de datos',
            { cause: error },
          );
        }
      },
    };
    const modulo = await Test.createTestingModule({ imports: [PeriodosModule] })
      .overrideProvider(DatabaseService)
      .useValue(db)
      .compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useLogger(false);
    await app.init();
    agente = request.agent(app.getHttpServer());
    await agente
      .post('/api/auth/login')
      .send({ username: 'rmarriaga@utb.edu.co', password: '12345' })
      .expect(201);
  }, 30000);
  beforeEach(async () => {
    barrera = null;
    conflictosSql = 0;
    await base.db.exec('TRUNCATE periodos_grado CASCADE');
  });
  afterAll(async () => {
    await app?.close();
    await base?.db.close();
  });
  it('acepta el ejemplo corregido y persiste las fechas', async () => {
    const r = await agente.post(RUTA).send(DATOS).expect(201);
    expect(r.body).toMatchObject(DATOS);
    expect((await agente.get(RUTA)).body).toHaveLength(1);
  });
  it.each([
    [
      'inicio igual al cierre',
      { fechaInicio: '2026-11-30' },
      'inicio debe ser anterior',
    ],
    [
      'inicio posterior al cierre',
      { fechaInicio: '2026-12-01' },
      'inicio debe ser anterior',
    ],
    [
      'graduación dentro del rango',
      { fechaGraduacion: '2026-11-15' },
      'graduación debe ser posterior',
    ],
    [
      'graduación igual al cierre',
      { fechaGraduacion: '2026-11-30' },
      'graduación debe ser posterior',
    ],
    [
      'graduación anterior al inicio',
      { fechaGraduacion: '2026-10-01' },
      'graduación debe ser posterior',
    ],
    ['día inexistente', { fechaFin: '2026-02-30' }, 'fechas deben ser válidas'],
    [
      'formato no ISO',
      { fechaInicio: '23/10/2026' },
      'fechas deben ser válidas',
    ],
    ['año cero', { fechaInicio: '0000-01-01' }, 'fechas deben ser válidas'],
    ['fecha no textual', { fechaInicio: 20261023 }, 'fechas deben ser válidas'],
    ['nombre vacío', { nombre: '   ' }, 'obligatorios'],
    ['nombre largo', { nombre: 'x'.repeat(121) }, 'máximo 120'],
    ['nombre no textual', { nombre: 123 }, 'obligatorios'],
    ['estado desconocido', { estado: 'OTRO' }, 'estado debe ser'],
    ['graduación omitida', { fechaGraduacion: null }, 'obligatorios'],
  ])('rechaza %s sin insertar', async (_n, cambio, mensaje) => {
    const r = await agente
      .post(RUTA)
      .send({ ...DATOS, ...cambio })
      .expect(400);
    expect(r.body.message).toContain(mensaje);
    expect(
      (await base.db.query('SELECT * FROM periodos_grado')).rows,
    ).toHaveLength(0);
  });
  it.each([
    { nombre: 'Otro nombre' },
    { estado: 'CERRADO' },
    { fechaGraduacion: '2027-01-15' },
    { nombre: 'Distinto', estado: 'CERRADO', fechaGraduacion: '2027-02-01' },
  ])('rechaza duplicado %j', async (cambio) => {
    await agente.post(RUTA).send(DATOS).expect(201);
    const r = await agente
      .post(RUTA)
      .send({ ...DATOS, ...cambio })
      .expect(409);
    expect(r.body.message).toContain('Ya existe un periodo con estas fechas');
    expect(
      (await base.db.query('SELECT * FROM periodos_grado')).rows,
    ).toHaveLength(1);
  });
  it('permite editar el mismo registro sin considerarlo duplicado', async () => {
    const { body: p } = await agente.post(RUTA).send(DATOS).expect(201);
    const r = await agente
      .patch(`${RUTA}/${p.id}`)
      .send({ nombre: 'Renombrado', estado: 'CERRADO' })
      .expect(200);
    expect(r.body).toMatchObject({
      ...DATOS,
      nombre: 'Renombrado',
      estado: 'CERRADO',
    });
  });
  it.each([
    [{ fechaInicio: '2026-11-30' }, 'inicio debe ser anterior'],
    [{ fechaGraduacion: '2026-11-15' }, 'graduación debe ser posterior'],
    [{ fechaFin: '2026-12-06' }, 'graduación debe ser posterior'],
    [{ fechaGraduacion: null }, 'obligatorios'],
  ])('valida PATCH parcial %j', async (cambio, mensaje) => {
    const { body: p } = await agente.post(RUTA).send(DATOS).expect(201);
    const r = await agente.patch(`${RUTA}/${p.id}`).send(cambio).expect(400);
    expect(r.body.message).toContain(mensaje);
    expect((await agente.get(RUTA)).body[0]).toEqual(p);
  });
  it('rechaza editar hacia el rango de otro registro', async () => {
    await agente.post(RUTA).send(DATOS).expect(201);
    const { body: p } = await agente
      .post(RUTA)
      .send({ ...DATOS, fechaInicio: '2026-10-24' })
      .expect(201);
    await agente
      .patch(`${RUTA}/${p.id}`)
      .send({ fechaInicio: DATOS.fechaInicio })
      .expect(409);
    expect(
      (await agente.get(RUTA)).body.find((x: { id: string }) => x.id === p.id),
    ).toEqual(p);
  });
  it('admite rangos distintos con el mismo nombre y ceremonia', async () => {
    await agente.post(RUTA).send(DATOS).expect(201);
    await agente
      .post(RUTA)
      .send({ ...DATOS, fechaInicio: '2026-10-24' })
      .expect(201);
  });
  it('una carrera que supera ambas consultas previas solo inserta una convocatoria', async () => {
    let liberar!: () => void,
      consultas = 0;
    const ambas = new Promise<void>((r) => {
      liberar = r;
    });
    barrera = async () => {
      if (++consultas === 2) liberar();
      await ambas;
    };
    const respuestas = await Promise.all([
      agente.post(RUTA).send(DATOS),
      agente.post(RUTA).send({ ...DATOS, nombre: 'Concurrente' }),
    ]);
    expect(respuestas.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(conflictosSql).toBe(1);
    expect(
      (await base.db.query('SELECT * FROM periodos_grado')).rows,
    ).toHaveLength(1);
  });
  it('devuelve 404 al editar un UUID inexistente', async () => {
    await agente
      .patch(`${RUTA}/11111111-1111-4111-8111-111111111111`)
      .send(DATOS)
      .expect(404);
  });
  it('exige sesión y rol funcionario', async () => {
    await request(app.getHttpServer()).post(RUTA).send(DATOS).expect(401);
    const alumno = request.agent(app.getHttpServer());
    await alumno
      .post('/api/auth/login')
      .send({ username: 'lizapata@utb.edu.co', password: '12345' })
      .expect(201);
    await alumno.post(RUTA).send(DATOS).expect(401);
  });
  it('la migración es repetible y conserva los registros', async () => {
    await agente.post(RUTA).send(DATOS).expect(201);
    await base.db.exec(await migracion());
    await base.db.exec(await migracion());
    expect((await agente.get(RUTA)).body).toHaveLength(1);
  });
  it('detecta duplicados heredados sin borrarlos', async () => {
    const db = await PGlite.create();
    try {
      await db.exec(
        "CREATE TABLE periodos_grado(id integer,fecha_inicio date,fecha_fin date); INSERT INTO periodos_grado VALUES(1,'2026-10-23','2026-11-30'),(2,'2026-10-23','2026-11-30')",
      );
      await expect(db.exec(await migracion())).rejects.toThrow(
        'Hay periodos con el mismo rango',
      );
      await db.exec('ROLLBACK');
      expect(
        (await db.query('SELECT * FROM periodos_grado')).rows,
      ).toHaveLength(2);
      await db.exec('DELETE FROM periodos_grado WHERE id=2');
      await db.exec(await migracion());
      await expect(
        db.exec(
          "INSERT INTO periodos_grado VALUES(3,'2026-10-23','2026-11-30')",
        ),
      ).rejects.toMatchObject({ code: '23505' });
    } finally {
      await db.close();
    }
  });
});
