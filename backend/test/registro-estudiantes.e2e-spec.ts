import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  HttpException,
  type INestApplication,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

const RUTA = '/api/funcionario/estudiantes';
const CABECERA = 'nombres;apellidos;codigo_estudiantil;correo;rol\n';
const DATOS = {
  nombres: 'María Elena',
  apellidos: 'Pérez Gómez',
  codigo_estudiantil: 'T00550001',
  correo: 'maria.perez@example.test',
  rol: 'ESTUDIANTE',
};

describe('Tarea 55: registro e importación con API Nest y PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>;
  let app: INestApplication<App>;
  let funcionaria: ReturnType<typeof request.agent>;
  let estudiante: ReturnType<typeof request.agent>;
  beforeAll(async () => {
    vi.stubEnv('AUTH_INIT', 'ENV');
    vi.stubEnv('AUTH_ESTUDIANTE_USERNAME', 'estudiante55@example.test');
    vi.stubEnv('AUTH_ESTUDIANTE_PASSWORD', 'Prueba-55-estudiante');
    vi.stubEnv('AUTH_FUNCIONARIO_USERNAME', 'funcionaria55@example.test');
    vi.stubEnv('AUTH_FUNCIONARIO_PASSWORD', 'Prueba-55-funcionaria');
    base = await crearDbBorrador();
    const servicio = {
      ...base.servicio,
      async query(sql: string, params?: unknown[]) {
        try {
          return await base.servicio.query(sql, params);
        } catch (error) {
          throw new ServiceUnavailableException(
            'Error en el servicio de base de datos',
            { cause: error },
          );
        }
      },
      async transaction<T>(
        callback: Parameters<typeof base.servicio.transaction<T>>[0],
      ) {
        try {
          return await base.servicio.transaction(callback);
        } catch (error) {
          if (error instanceof HttpException) throw error;
          throw new ServiceUnavailableException(
            'Error en el servicio de base de datos',
            { cause: error },
          );
        }
      },
    };
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(servicio)
      .compile();
    app = modulo.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    await app.init();
    funcionaria = request.agent(app.getHttpServer());
    estudiante = request.agent(app.getHttpServer());
    await funcionaria
      .post('/api/auth/login')
      .send({
        username: 'funcionaria55@example.test',
        password: 'Prueba-55-funcionaria',
      })
      .expect(201);
    await estudiante
      .post('/api/auth/login')
      .send({
        username: 'estudiante55@example.test',
        password: 'Prueba-55-estudiante',
      })
      .expect(201);
  }, 30000);
  beforeEach(async () => {
    await base.db.exec(
      'DROP TRIGGER IF EXISTS fallo_importacion_55 ON usuarios; DELETE FROM usuarios WHERE id_usuario > 2',
    );
  });
  afterAll(async () => {
    await app?.close();
    await base?.db.close();
    vi.unstubAllEnvs();
  });

  function importar(
    texto: string | Buffer,
    nombre = 'estudiantes.csv',
    agente = funcionaria,
  ) {
    return agente
      .post(`${RUTA}/importar`)
      .attach('archivo', Buffer.isBuffer(texto) ? texto : Buffer.from(texto), {
        filename: nombre,
        contentType: 'text/csv',
      });
  }
  async function usuariosNuevos() {
    return (
      await base.db.query(
        'SELECT * FROM usuarios WHERE id_usuario > 2 ORDER BY id_usuario',
      )
    ).rows;
  }

  it('registra datos reales en usuarios, normaliza el código y guarda el correo obligatorio', async () => {
    const r = await funcionaria
      .post(RUTA)
      .send({
        ...DATOS,
        nombres: '  María Elena ',
        codigo_estudiantil: ' t00550001 ',
      })
      .expect(201);
    expect(r.body).toMatchObject(DATOS);
    expect(r.headers['cache-control']).toContain('no-store');
    const usuarios = await usuariosNuevos();
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0]).toMatchObject({
      nombres: DATOS.nombres,
      apellidos: DATOS.apellidos,
      codigo_estudiante: DATOS.codigo_estudiantil,
      rol: 'ESTUDIANTE',
      correo: 'maria.perez@example.test',
      activo: true,
    });
  });
  it('permite registrar estudiante sin código estudiantil', async () => {
    const r = await funcionaria
      .post(RUTA)
      .send({ ...DATOS, codigo_estudiantil: '' })
      .expect(201);
    expect(r.body.codigo_estudiantil).toBeNull();
    const usuarios = await usuariosNuevos();
    expect(usuarios[0].codigo_estudiante).toBeNull();
    expect(usuarios[0].correo).toBe('maria.perez@example.test');
  });
  it('conserva los ceros iniciales de códigos numéricos', async () => {
    const r = await funcionaria
      .post(RUTA)
      .send({ ...DATOS, codigo_estudiantil: '000123' })
      .expect(201);
    expect(r.body.codigo_estudiantil).toBe('000123');
  });
  it('normaliza y guarda el correo electrónico obligatorio', async () => {
    const r = await funcionaria
      .post(RUTA)
      .send({ ...DATOS, correo: '  María.Pérez@Example.TEST ' })
      .expect(201);
    expect(r.body.correo).toBe('maría.pérez@example.test');
    expect((await usuariosNuevos())[0]).toMatchObject({
      correo: 'maría.pérez@example.test',
    });
  });
  it('rechaza un correo electrónico ya registrado', async () => {
    await funcionaria
      .post(RUTA)
      .send({ ...DATOS, correo: 'ana@example.test' })
      .expect(201);
    const r = await funcionaria
      .post(RUTA)
      .send({
        ...DATOS,
        codigo_estudiantil: 'T00550002',
        correo: 'ana@example.test',
      })
      .expect(409);
    expect(r.body.message).toContain('correo electrónico ya está registrado');
    expect(await usuariosNuevos()).toHaveLength(1);
  });
  it.each([
    ['nombres vacíos', { nombres: '  ' }],
    ['apellidos ausentes', { apellidos: null }],
    ['nombres muy largos', { nombres: 'a'.repeat(101) }],
    ['apellidos muy largos', { apellidos: 'a'.repeat(101) }],
    ['nombres no textuales', { nombres: 123 }],
    ['saltos de línea en el nombre', { nombres: 'Ana\nMaría' }],
    ['código numérico JSON', { codigo_estudiantil: 123 }],
    ['código largo', { codigo_estudiantil: 'A'.repeat(51) }],
    ['código con espacios internos', { codigo_estudiantil: 'T 123' }],
    ['correo ausente', { correo: null }],
    ['correo vacío', { correo: '   ' }],
    ['correo no textual', { correo: 123 }],
    ['correo sin arroba', { correo: 'ana.example.test' }],
    ['correo sin dominio', { correo: 'ana@' }],
    ['correo con salto de línea', { correo: 'ana@example\n.test' }],
    ['correo muy largo', { correo: `${'a'.repeat(146)}@x.co` }],
    ['rol funcionario', { rol: 'FUNCIONARIO' }],
    ['rol biblioteca', { rol: 'BIBLIOTECA' }],
    ['rol ausente', { rol: null }],
  ])('rechaza %s antes de insertar', async (_nombre, cambio) => {
    const r = await funcionaria
      .post(RUTA)
      .send({ ...DATOS, ...cambio })
      .expect(400);
    expect(r.body.message).toBeTruthy();
    expect(await usuariosNuevos()).toHaveLength(0);
  });
  it('ignora campos extra y conserva el rol Estudiante', async () => {
    const r = await funcionaria
      .post(RUTA)
      .send({
        ...DATOS,
        id_usuario: 1,
        activo: false,
      })
      .expect(201);
    expect(r.body.id_usuario).not.toBe(1);
    expect((await usuariosNuevos())[0]).toMatchObject({
      rol: 'ESTUDIANTE',
      correo: 'maria.perez@example.test',
      activo: true,
    });
  });
  it('rechaza un código heredado escrito con otra combinación de mayúsculas', async () => {
    await base.db.exec(
      "INSERT INTO usuarios(nombres,apellidos,rol,codigo_estudiante) VALUES('Anterior','Prueba','ESTUDIANTE',' t00550001 ')",
    );
    await funcionaria.post(RUTA).send(DATOS).expect(409);
    expect(await usuariosNuevos()).toHaveLength(1);
  });
  it('dos registros simultáneos del mismo código crean un solo usuario', async () => {
    const respuestas = await Promise.all([
      funcionaria.post(RUTA).send(DATOS),
      funcionaria
        .post(RUTA)
        .send({ ...DATOS, codigo_estudiantil: 't00550001' }),
    ]);
    expect(respuestas.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await usuariosNuevos()).toHaveLength(1);
  });
  it.each(['individual', 'csv'])(
    'exige sesión y rol funcionario para %s',
    async (tipo) => {
      const anonimo = request.agent(app.getHttpServer());
      if (tipo === 'individual') {
        await anonimo.post(RUTA).send(DATOS).expect(401);
        await estudiante.post(RUTA).send(DATOS).expect(403);
      } else {
        await importar(
          CABECERA + 'Ana;Pérez;T55;ana@example.test;ESTUDIANTE',
          'estudiantes.csv',
          anonimo,
        ).expect(401);
        await importar(
          CABECERA + 'Ana;Pérez;T55;ana@example.test;ESTUDIANTE',
          'estudiantes.csv',
          estudiante,
        ).expect(403);
      }
      expect(await usuariosNuevos()).toHaveLength(0);
    },
  );
  it('una cookie malformada devuelve 401', async () => {
    await request(app.getHttpServer())
      .post(RUTA)
      .set('Cookie', 'checku.sid=%E0%A4%A')
      .send(DATOS)
      .expect(401);
  });
  it('importa BOM, CRLF, tildes y comillas escapadas con el rol correcto', async () => {
    const r = await importar(
      '\uFEFF' +
        CABECERA.replace('\n', '\r\n') +
        '"María ""Luz""";Pérez;T55-1;maria.luz@example.test;ESTUDIANTE\r\nAna;Gómez;00055;ana.gomez@example.test;ESTUDIANTE\r\n',
    ).expect(200);
    expect(r.body).toMatchObject({ total: 2, registrados: 2, errores: 0 });
    expect(r.body.filas.map((f: { linea: number }) => f.linea)).toEqual([2, 3]);
    expect((await usuariosNuevos())[0].nombres).toBe('María "Luz"');
    expect((await usuariosNuevos()).map((u) => u.rol)).toEqual([
      'ESTUDIANTE',
      'ESTUDIANTE',
    ]);
  });
  it('informa por línea los éxitos, campos ausentes, rol inválido y duplicados', async () => {
    await funcionaria
      .post(RUTA)
      .send({ ...DATOS, codigo_estudiantil: 'EXISTENTE' })
      .expect(201);
    const r = await importar(
      CABECERA +
        [
          'Ana;Pérez;T55-1;ana.perez1@example.test;ESTUDIANTE',
          ';Pérez;T55-2;perez2@example.test;ESTUDIANTE',
          'Luis;Gómez;T55-3;luis@example.test;FUNCIONARIO',
          'Ana;Otra; t55-1 ;ana.otra@example.test;ESTUDIANTE',
          'Eva;Gómez;EXISTENTE;eva@example.test;ESTUDIANTE',
          'Fila;Con;Demasiadas;correo@test;ESTUDIANTE;Extra',
          'Sol;Martínez;T55-4;sol@example.test;ESTUDIANTE',
        ].join('\n'),
    ).expect(200);
    expect(r.body).toMatchObject({ total: 7, registrados: 2, errores: 5 });
    expect(r.body.filas.map((f: { linea: number }) => f.linea)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(r.body.filas[2].mensaje).toContain('rol debe ser ESTUDIANTE');
    expect(r.body.filas[3].mensaje).toContain('se repite');
    expect(r.body.filas[4].mensaje).toContain('ya está registrado');
    expect(r.body.filas[5].mensaje).toContain('cinco columnas');
    expect(await usuariosNuevos()).toHaveLength(3);
  });
  it('reimportar no sobrescribe a los estudiantes ya registrados', async () => {
    await importar(
      CABECERA + 'Ana;Pérez;T55;ana@example.test;ESTUDIANTE',
    ).expect(200);
    const r = await importar(
      CABECERA + 'Otro;Nombre;T55;otro@example.test;ESTUDIANTE',
    ).expect(200);
    expect(r.body).toMatchObject({ registrados: 0, errores: 1 });
    expect((await usuariosNuevos())[0].nombres).toBe('Ana');
  });
  it('importa CSV con correo obligatorio y código opcional, detecta errores y duplicados', async () => {
    const r = await importar(
      CABECERA +
        [
          'Ana;Pérez;T55-C1;ana.csv@example.test;ESTUDIANTE',
          'Luis;Gómez;;luis.csv@example.test;ESTUDIANTE',
          'María;López;T55-C3;ana.csv@example.test;ESTUDIANTE',
          'Carlos;Sánchez;T55-C4;correo-invalido;ESTUDIANTE',
          'Elena;Díaz;T55-C5;;ESTUDIANTE',
        ].join('\n'),
    ).expect(200);
    expect(r.body).toMatchObject({ total: 5, registrados: 2, errores: 3 });
    expect(r.body.filas[0]).toMatchObject({
      estado: 'registrado',
      codigo_estudiantil: 'T55-C1',
      correo: 'ana.csv@example.test',
    });
    expect(r.body.filas[1]).toMatchObject({
      estado: 'registrado',
      codigo_estudiantil: null,
      correo: 'luis.csv@example.test',
    });
    expect(r.body.filas[2].mensaje).toContain('se repite en este archivo');
    expect(r.body.filas[3].mensaje).toContain('formato válido');
    expect(r.body.filas[4].mensaje).toContain('correo electrónico es obligatorio');
  });
  it('las filas inválidas se informan sin crear estudiantes', async () => {
    const r = await importar(CABECERA + ';;;;\nAna;Gómez;;;ESTUDIANTE').expect(
      200,
    );
    expect(r.body).toMatchObject({ total: 2, registrados: 0, errores: 2 });
    expect(await usuariosNuevos()).toHaveLength(0);
  });
  it.each([
    [
      'encabezado de comas',
      'nombres,apellidos,codigo_estudiantil,correo,rol\nAna,Pérez,T55,ana@example.test,ESTUDIANTE',
    ],
    [
      'encabezado incompleto',
      'nombres;apellidos;codigo_estudiantil\nAna;Pérez;T55',
    ],
    ['archivo vacío', ''],
    ['solo encabezado', CABECERA],
    ['comillas sin cerrar', CABECERA + '"Ana;Pérez;T55;ana@example.test;ESTUDIANTE'],
    ['texto después de comillas', CABECERA + '"Ana"extra;Pérez;T55;ana@example.test;ESTUDIANTE'],
  ])('rechaza %s sin importar ninguna fila', async (_nombre, texto) => {
    await importar(texto).expect(400);
    expect(await usuariosNuevos()).toHaveLength(0);
  });
  it('respeta líneas en blanco y reporta nombres multilínea como inválidos', async () => {
    const r = await importar(
      CABECERA +
        '\n"Ana\nMaría";Pérez;T55;ana@example.test;ESTUDIANTE\nSol;Gómez;T56;sol@example.test;ESTUDIANTE',
    ).expect(200);
    expect(r.body).toMatchObject({ registrados: 1, errores: 1 });
    expect(r.body.filas.map((f: { linea: number }) => f.linea)).toEqual([3, 5]);
  });
  it('rechaza codificación inválida, otro tipo de archivo y archivo ausente', async () => {
    await importar(Buffer.from([0xff, 0xfe, 0x41, 0])).expect(400);
    await importar(
      CABECERA + 'Ana;Pérez;T55;ana@example.test;ESTUDIANTE',
      'archivo.pdf',
    ).expect(400);
    await funcionaria.post(`${RUTA}/importar`).expect(400);
  });
  it('rechaza archivos que superan el límite antes de procesarlos', async () => {
    await importar(Buffer.alloc(65537, 'a')).expect(413);
    expect(await usuariosNuevos()).toHaveLength(0);
  });
  it('rechaza más de 1000 registros', async () => {
    await importar(
      CABECERA +
        Array.from(
          { length: 1001 },
          (_, i) => `A;B;T${i};correo${i}@example.test;ESTUDIANTE`,
        ).join('\n'),
    ).expect(400);
    expect(await usuariosNuevos()).toHaveLength(0);
  });
  it('un fallo SQL revierte la importación y permite reintentar sin datos parciales', async () => {
    await base.db.exec(
      `CREATE OR REPLACE FUNCTION fallo_importacion_55() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.codigo_estudiante='FALLAR' THEN RAISE EXCEPTION 'Fallo de prueba'; END IF; RETURN NEW; END $$; CREATE TRIGGER fallo_importacion_55 BEFORE INSERT ON usuarios FOR EACH ROW EXECUTE FUNCTION fallo_importacion_55()`,
    );
    const csv =
      CABECERA +
      'Ana;Pérez;PRIMERO;ana.primero@example.test;ESTUDIANTE\nSol;Gómez;FALLAR;sol.fallar@example.test;ESTUDIANTE';
    await importar(csv).expect(503);
    expect(await usuariosNuevos()).toHaveLength(0);
    await base.db.exec('DROP TRIGGER fallo_importacion_55 ON usuarios');
    const r = await importar(csv).expect(200);
    expect(r.body.registrados).toBe(2);
  });
  it('conserva correo obligatorio para funcionarios y rechaza duplicados desde SQL', async () => {
    await expect(
      base.db.exec(
        "INSERT INTO usuarios(nombres,apellidos,rol) VALUES('Otra','Persona','FUNCIONARIO')",
      ),
    ).rejects.toThrow();
    await funcionaria.post(RUTA).send(DATOS).expect(201);
    await expect(
      base.db.exec(
        "INSERT INTO usuarios(nombres,apellidos,rol,codigo_estudiante) VALUES('Otra','Persona','ESTUDIANTE',' t00550001 ')",
      ),
    ).rejects.toThrow();
  });
  it('la migración se puede repetir y detecta duplicados heredados sin borrar registros', async () => {
    const sql = await readFile(
      new URL(
        '../../db/migrations/011-registro-estudiantes.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await base.db.exec(sql);
    await base.db.exec(sql);
    const db = await PGlite.create();
    try {
      await db.exec(
        "CREATE TABLE usuarios(id_usuario integer, codigo_estudiante text, rol text, correo text NOT NULL); INSERT INTO usuarios VALUES(1,'T55','ESTUDIANTE','a@example.test'),(2,' t55 ','ESTUDIANTE','b@example.test')",
      );
      await expect(db.exec(sql)).rejects.toThrow(
        'códigos estudiantiles duplicados',
      );
      await db.exec('ROLLBACK');
      expect((await db.query('SELECT * FROM usuarios')).rows).toHaveLength(2);
      await db.exec('DELETE FROM usuarios WHERE id_usuario=2');
      await db.exec(sql);
      await db.exec("INSERT INTO usuarios VALUES(3,'T56','ESTUDIANTE',NULL)");
    } finally {
      await db.close();
    }
  }, 30000);
});
