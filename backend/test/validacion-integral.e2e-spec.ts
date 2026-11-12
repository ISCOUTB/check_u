import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { crearDbBorrador } from './soporte/db-borrador.js';
import { PlazosSolicitudService } from '../src/solicitudes/plazos-solicitud.service.js';
import {
  datosPreinscripcion,
  documentosActuales,
  enviar,
  estadoSolicitud,
  montarFlujo,
  PERIODO,
  reenviar,
  reiniciar,
  resultadoBiblioteca,
  type Flujo,
} from './soporte/flujo-tarea42.js';
import { BibliotecaService } from '../src/biblioteca/biblioteca.service.js';

describe('Tarea 42: esquema', () => {
  let base: Awaited<ReturnType<typeof crearDbBorrador>>;
  beforeAll(async () => {
    base = await crearDbBorrador();
  }, 30000);
  afterAll(async () => {
    await base?.db.close();
  });
  beforeEach(async () => {
    await base.db
      .exec(`TRUNCATE notificaciones,revisiones,historial_validaciones,validaciones,rutas,documentos,entregas,
      solicitud_programa,solicitud_grado,periodos_grado RESTART IDENTITY CASCADE;
      INSERT INTO periodos_grado(id,nombre,fecha_inicio,fecha_fin,fecha_graduacion)
      VALUES('${PERIODO}','Periodo prueba',CURRENT_DATE-60,CURRENT_DATE+30,CURRENT_DATE+60)`);
  });

  async function solicitudConDocumento(estadoDocumento: string) {
    const s = await base.db.query<{ id: number }>(
      `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo)
      VALUES(1,'POSGRADO','POR_REVISAR',$1) RETURNING id_solicitud AS id`,
      [PERIODO],
    );
    const id = s.rows[0].id;
    const e = await base.db.query<{ id: number }>(
      `INSERT INTO entregas(id_solicitud,numero_entrega,tipo_entrega) VALUES($1,1,'INICIAL') RETURNING id_entrega AS id`,
      [id],
    );
    const d = await base.db.query<{ id: number }>(
      `INSERT INTO documentos(id_solicitud,id_entrega,tipo_documento,orden,nombre_original,mime_type,tamano_bytes,version,estado)
      VALUES($1,$2,'identification',1,'cedula.pdf','application/pdf',10,1,$3) RETURNING id_documento AS id`,
      [id, e.rows[0].id, estadoDocumento],
    );
    return { solicitud: id, documento: d.rows[0].id };
  }

  function resolver(solicitud: number, documentos: number[]) {
    return base.db.query(
      `INSERT INTO revisiones(id_solicitud,id_funcionario,resultado,comentario,documentos_ids)
      VALUES($1,2,'DOCUMENTO_RESUELTO','Revisado contra el original',$2)`,
      [solicitud, documentos],
    );
  }

  it('acepta ACEPTADA y rechaza un estado desconocido', async () => {
    await base.db.query(
      `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado) VALUES(1,'PREGRADO','ACEPTADA')`,
    );
    await expect(
      base.db.query(
        `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado) VALUES(1,'PREGRADO','APROBADA')`,
      ),
    ).rejects.toThrow(/chk_estado_solicitud/);
  });

  it('admite la validación MANUAL y rechaza un tipo desconocido', async () => {
    const { documento } = await solicitudConDocumento('VALIDO');
    await base.db.query(
      `INSERT INTO validaciones(id_documento,tipo_validacion,resultado) VALUES($1,'MANUAL','VALIDO')`,
      [documento],
    );
    await expect(
      base.db.query(
        `INSERT INTO validaciones(id_documento,tipo_validacion,resultado) VALUES($1,'HUMANA','VALIDO')`,
        [documento],
      ),
    ).rejects.toThrow(/chk_validacion_tipo/);
  });

  it('una resolución manual válida notifica al estudiante', async () => {
    const { solicitud, documento } = await solicitudConDocumento('VALIDO');
    await resolver(solicitud, [documento]);
    const n = await base.db.query<Record<string, string>>(
      'SELECT estudiante_id,tipo,titulo,msg,generado_por FROM notificaciones',
    );
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]).toMatchObject({
      estudiante_id: 1,
      tipo: 'success',
      titulo: 'Documento validado',
      generado_por: 'funcionario',
    });
    expect(n.rows[0].msg).toContain('Documento de identidad');
  });

  it('una resolución manual no válida notifica con el comentario', async () => {
    const { solicitud, documento } = await solicitudConDocumento('NO_VALIDO');
    await resolver(solicitud, [documento]);
    const n = await base.db.query<Record<string, string>>(
      'SELECT tipo,titulo,msg FROM notificaciones',
    );
    expect(n.rows[0]).toMatchObject({
      tipo: 'error',
      titulo: 'Documento no válido',
    });
    expect(n.rows[0].msg).toContain('Revisado contra el original');
  });

  it('la migración 009 deja ACEPTADA lo que se aceptó antes de la Tarea 42', async () => {
    const { solicitud } = await solicitudConDocumento('NO_VALIDO');
    await base.db.query(
      "UPDATE solicitud_grado SET estado='VALIDA' WHERE id_solicitud=$1",
      [solicitud],
    );
    await base.db.query(
      "INSERT INTO revisiones(id_solicitud,id_funcionario,resultado) VALUES($1,2,'APROBADA')",
      [solicitud],
    );
    const calculada = (
      await base.db.query<{ id: number }>(
        `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo)
        VALUES(1,'POSGRADO','VALIDA',$1) RETURNING id_solicitud AS id`,
        [PERIODO],
      )
    ).rows[0].id;
    await base.db.exec(
      await readFile(
        // La antigua migración 009 de la Tarea 42 quedó al final de 01-schema.sql (#124).
        new URL('../../db/init/01-schema.sql', import.meta.url),
        'utf8',
      ),
    );
    const estados = await base.db.query<{
      id_solicitud: number;
      estado: string;
    }>(
      'SELECT id_solicitud, estado FROM solicitud_grado ORDER BY id_solicitud',
    );
    expect(estados.rows).toEqual([
      { id_solicitud: solicitud, estado: 'ACEPTADA' },
      { id_solicitud: calculada, estado: 'VALIDA' },
    ]);
  });

  it('la resolución exige exactamente un documento', async () => {
    const { solicitud, documento } = await solicitudConDocumento('VALIDO');
    await expect(resolver(solicitud, [])).rejects.toThrow(/un documento/);
    await expect(resolver(solicitud, [documento, documento])).rejects.toThrow(
      /un documento/,
    );
  });
});

describe('Tarea 42: el esquema base solo, como lo aplica levantar.ps1', () => {
  // levantar.ps1 aplica 01-schema.sql y 02-userbase.sql (también sobre una base existente), sin
  // las migraciones: el esquema base debe quedar completo por sí mismo y poder repetirse.
  it('trae ACEPTADA, la resolución manual y la cancelación desde un estado calculado', async () => {
    const db = await PGlite.create();
    try {
      const esquema = await readFile(
        new URL('../../db/init/01-schema.sql', import.meta.url),
        'utf8',
      );
      await db.exec(esquema);
      await db.exec(
        await readFile(
          new URL('../../db/init/02-userbase.sql', import.meta.url),
          'utf8',
        ),
      );
      await db.exec(esquema);
      const s = await db.query<{ id: number }>(
        "INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado) VALUES(1,'POSGRADO','ACEPTADA') RETURNING id_solicitud AS id",
      );
      const e = await db.query<{ id: number }>(
        "INSERT INTO entregas(id_solicitud,numero_entrega,tipo_entrega) VALUES($1,1,'INICIAL') RETURNING id_entrega AS id",
        [s.rows[0].id],
      );
      const d = await db.query<{ id: number }>(
        `INSERT INTO documentos(id_solicitud,id_entrega,tipo_documento,orden,nombre_original,mime_type,tamano_bytes,version,estado)
        VALUES($1,$2,'identification',1,'c.pdf','application/pdf',10,1,'VALIDO') RETURNING id_documento AS id`,
        [s.rows[0].id, e.rows[0].id],
      );
      await db.query(
        "INSERT INTO validaciones(id_documento,tipo_validacion,resultado) VALUES($1,'MANUAL','VALIDO')",
        [d.rows[0].id],
      );
      await db.query(
        "INSERT INTO revisiones(id_solicitud,id_funcionario,resultado,documentos_ids) VALUES($1,2,'DOCUMENTO_RESUELTO',$2)",
        [s.rows[0].id, [d.rows[0].id]],
      );
      const c = await db.query<{ id: number }>(
        "INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado) VALUES(1,'PREGRADO','NO_VALIDA') RETURNING id_solicitud AS id",
      );
      await db.query(
        "UPDATE solicitud_grado SET estado='CANCELADA' WHERE id_solicitud=$1",
        [c.rows[0].id],
      );
      const a = await db.query<{ estado_anterior: string }>(
        'SELECT estado_anterior FROM cancelaciones_preinscripcion',
      );
      expect(a.rows).toEqual([{ estado_anterior: 'NO_VALIDA' }]);
      // Tarea 50: Paz y Salvo es un documento sin archivo (origen CONSULTA).
      const consulta = await db.query<{ origen: string }>(
        `INSERT INTO documentos(id_solicitud,id_entrega,tipo_documento,orden,version,estado,origen)
        VALUES($1,$2,'paz_y_salvo_bib',1,1,'VALIDO','CONSULTA') RETURNING origen`,
        [s.rows[0].id, e.rows[0].id],
      );
      expect(consulta.rows).toEqual([{ origen: 'CONSULTA' }]);
      await expect(
        db.query(
          `INSERT INTO documentos(id_solicitud,id_entrega,tipo_documento,orden,version,estado)
          VALUES($1,$2,'saber_pro',1,1,'VALIDO')`,
          [s.rows[0].id, e.rows[0].id],
        ),
      ).rejects.toThrow(/chk_documento_archivo/);
      await expect(
        db.query(
          `INSERT INTO documentos(id_solicitud,id_entrega,tipo_documento,orden,version,estado,origen,nombre_original,mime_type,tamano_bytes)
          VALUES($1,$2,'saber_pro',2,1,'VALIDO','OTRO','s.pdf','application/pdf',10)`,
          [s.rows[0].id, e.rows[0].id],
        ),
      ).rejects.toThrow(/chk_documento_origen/);
    } finally {
      await db.close();
    }
  }, 30000);
});

describe('Tarea 42: flujo de la solicitud', () => {
  let flujo: Flujo;
  beforeAll(async () => {
    flujo = await montarFlujo();
  }, 30000);
  afterAll(async () => {
    await flujo?.cerrar();
  });
  beforeEach(async () => {
    await reiniciar(flujo);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('Tarea 50: Paz y Salvo no se sube', () => {
    it('un borrador viejo con PDF de Paz y Salvo se envía sin él', async () => {
      await flujo.estudiante
        .post('/api/solicitudes/borrador')
        .send({
          ...datosPreinscripcion(),
          documentos: [
            { id: 'paz_y_salvo_bib', nombre: 'paz.pdf', tamano: 10 },
            { id: 'saber_pro', nombre: 'saber.pdf', tamano: 10 },
          ],
        })
        .expect(201);
      const envio = await enviar(flujo).expect(201);
      const pdfs = await flujo.base.db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM documentos WHERE id_solicitud=$1 AND tipo_documento='paz_y_salvo_bib' AND origen='ARCHIVO'",
        [envio.body.id_solicitud],
      );
      expect(pdfs.rows[0].n).toBe(0);
    });

    it('adjuntar el PDF de Paz y Salvo se rechaza', async () => {
      const r = await enviar(flujo, {
        claves: [
          'identification',
          'academic_evaluation',
          'paz_y_salvo_bib',
          'estampilla_pro_cultura',
          'saber_pro',
        ],
      }).expect(400);
      expect(r.body.message).toBe(
        'Paz y Salvo se consulta automáticamente con Biblioteca; no se sube.',
      );
    });
  });

  describe('Paz y Salvo (Tarea 50: consulta a ALMA, sin archivo)', () => {
    it.each([
      ['paz_y_salvo', 'VALIDO', 'VALIDA'],
      ['con_deuda', 'NO_VALIDO', 'NO_VALIDA'],
      ['inconsistente', 'INCONSISTENTE', 'INCONSISTENTE'],
      ['no_encontrado', 'POR_REVISAR', 'POR_REVISAR'],
      ['sin_respuesta', 'POR_REVISAR', 'POR_REVISAR'],
      ['error', 'POR_REVISAR', 'POR_REVISAR'],
      ['invalido', 'POR_REVISAR', 'POR_REVISAR'],
    ] as const)(
      'Biblioteca responde %s: el documento queda %s y la solicitud %s',
      async (respuesta, documento, solicitud) => {
        flujo.biblioteca.respuesta = respuesta;
        const envio = await enviar(flujo).expect(201);
        const id = envio.body.id_solicitud as number;
        expect(envio.body.estado).toBe(solicitud);
        const fila = await flujo.base.db.query<Record<string, unknown>>(
          `SELECT d.estado, d.origen, d.nombre_original, d.tamano_bytes, v.tipo_validacion,
            v.detalle->'resultado'->>'estado' AS resultado
          FROM documentos d JOIN validaciones v ON v.id_documento=d.id_documento
          WHERE d.id_solicitud=$1 AND d.tipo_documento='paz_y_salvo_bib'`,
          [id],
        );
        expect(fila.rows).toHaveLength(1);
        expect(fila.rows[0]).toMatchObject({
          estado: documento,
          origen: 'CONSULTA',
          nombre_original: null,
          tamano_bytes: null,
          tipo_validacion: 'REQUISITOS',
        });
        expect(flujo.motor.llamadas).not.toContain('paz_y_salvo_bib');
        expect(flujo.biblioteca.llamadas).toBe(1);
      },
    );

    it('el detalle del estudiante y el de la funcionaria traen el resultado de Biblioteca', async () => {
      flujo.biblioteca.respuesta = 'con_deuda';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const analisis = await flujo.estudiante
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      const detalle = await flujo.funcionaria
        .get(`/api/funcionario/solicitudes/${id}`)
        .expect(200);
      for (const cuerpo of [analisis.body, detalle.body]) {
        const paz = cuerpo.documentos.find(
          (d: { tipo: string }) => d.tipo === 'paz_y_salvo_bib',
        );
        expect(paz.origen).toBe('CONSULTA');
        expect(paz.archivoDisponible).toBe(false);
        expect(paz.bibliotecaResultado.estado).toBe('no_cumple');
        expect(paz.bibliotecaResultado.criterios.multas.valor_total).toBe(
          15000,
        );
        expect(paz.resultados[0].mensaje).toBe('Tiene 1 multa pendiente.');
      }
    });

    it('la consulta usa la identidad guardada en CheckU', async () => {
      const consultar = vi
        .fn()
        .mockResolvedValue(resultadoBiblioteca('paz_y_salvo'));
      const biblioteca = flujo.app.get(BibliotecaService);
      const original = biblioteca.consultar;
      biblioteca.consultar = consultar;
      try {
        await enviar(flujo).expect(201);
      } finally {
        biblioteca.consultar = original;
      }
      expect(consultar).toHaveBeenCalledWith({
        codigo: 'T00000001',
        numeroDocumento: '1000000001',
        nombres: 'Estudiante',
        apellidos: 'Prueba',
      });
    });
  });

  describe('estado tras el envío', () => {
    it('pregrado con 5 válidos queda VALIDA', async () => {
      const envio = await enviar(flujo).expect(201);
      expect(envio.body.estado).toBe('VALIDA');
      expect(await estadoSolicitud(flujo, envio.body.id_solicitud)).toBe(
        'VALIDA',
      );
    });

    it('posgrado con 3 válidos queda VALIDA', async () => {
      const envio = await enviar(flujo, { nivel: 'POSGRADO' }).expect(201);
      expect(envio.body.estado).toBe('VALIDA');
    });

    it('Saber Pro con 95 deja NO_VALIDA; corregirlo con un archivo válido deja VALIDA', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      expect(envio.body.estado).toBe('NO_VALIDA');
      flujo.clasificacion.saber_pro = 'valid';
      const docs = await documentosActuales(flujo, id);
      const r = await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(
        201,
      );
      expect(r.body.estado).toBe('VALIDA');
      expect(await estadoSolicitud(flujo, id)).toBe('VALIDA');
    });

    it('Saber Pro reenviado igual sigue NO_VALIDA', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      const r = await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(
        201,
      );
      expect(r.body.estado).toBe('NO_VALIDA');
    });

    it('una cédula inconsistente con el resto válido deja INCONSISTENTE', async () => {
      flujo.clasificacion.identification = 'inconsistent';
      const envio = await enviar(flujo).expect(201);
      expect(envio.body.estado).toBe('INCONSISTENTE');
    });

    it('un reenvío con 3 documentos cuenta como 1 de 3', async () => {
      for (const t of ['identification', 'academic_evaluation', 'saber_pro'])
        flujo.clasificacion[t] = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      await reenviar(flujo, id, [
        docs.identification.id_documento,
        docs.academic_evaluation.id_documento,
        docs.saber_pro.id_documento,
      ]).expect(201);
      const analisis = await flujo.estudiante
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      expect(analisis.body.politicaReenvios.usados).toBe(1);
    });

    it('doble programa exige 7 documentos y la evaluación 2 se analiza con su orden', async () => {
      const seis = [
        'identification',
        'academic_evaluation',
        'paz_y_salvo_bib',
        'estampilla_pro_cultura',
        'estampilla_pro_cultura-2',
        'saber_pro',
      ];
      await enviar(flujo, { doble: true, claves: seis }).expect(400);
      flujo.clasificacion['academic_evaluation-2'] = 'invalid';
      const envio = await enviar(flujo, { doble: true }).expect(201);
      const docs = await documentosActuales(flujo, envio.body.id_solicitud);
      expect(Object.keys(docs).sort()).toEqual([
        'academic_evaluation',
        'academic_evaluation-2',
        'estampilla_pro_cultura',
        'estampilla_pro_cultura-2',
        'identification',
        'paz_y_salvo_bib',
        'saber_pro',
      ]);
      expect(docs.academic_evaluation.estado).toBe('VALIDO');
      expect(docs['academic_evaluation-2'].estado).toBe('NO_VALIDO');
      expect(envio.body.estado).toBe('NO_VALIDA');
    });

    it('el estado se calcula una sola vez por envío', async () => {
      const espia = vi.spyOn(flujo.base.db, 'query');
      try {
        await enviar(flujo).expect(201);
        const actualizaciones = espia.mock.calls.filter(([sql]) =>
          /UPDATE solicitud_grado\s+SET estado/i.test(String(sql)),
        );
        expect(actualizaciones).toHaveLength(1);
      } finally {
        espia.mockRestore();
      }
    });
  });

  describe('Tarea 50: Consultar de nuevo el Paz y Salvo', () => {
    let claves = 0;
    const clave = () => `reconsulta-prueba-${++claves}`;
    function reconsultar(id: number, c = clave()) {
      return flujo.estudiante
        .post(`/api/estudiante/solicitudes/${id}/paz-y-salvo/consulta`)
        .send({ clave: c });
    }
    function reconsultarFuncionaria(id: number, agente = flujo.funcionaria) {
      return agente
        .post(`/api/funcionario/solicitudes/${id}/paz-y-salvo/consulta`)
        .send({});
    }
    async function conDeuda() {
      flujo.biblioteca.respuesta = 'con_deuda';
      const envio = await enviar(flujo).expect(201);
      expect(envio.body.estado).toBe('NO_VALIDA');
      return envio.body.id_solicitud as number;
    }
    async function usados() {
      const r = await flujo.estudiante
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      return r.body.politicaReenvios.usados as number;
    }
    async function entregas(id: number) {
      const r = await flujo.base.db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM entregas WHERE id_solicitud=$1',
        [id],
      );
      return r.rows[0].n;
    }

    it('el estudiante se pone al día y la reconsulta deja la solicitud VALIDA, contando un reenvío', async () => {
      const id = await conDeuda();
      flujo.biblioteca.respuesta = 'paz_y_salvo';
      const r = await reconsultar(id).expect(201);
      expect(r.body).toMatchObject({ ok: true, id_solicitud: id, estado: 'VALIDA' });
      expect(await usados()).toBe(1);
      const docs = await documentosActuales(flujo, id);
      expect(docs.paz_y_salvo_bib.estado).toBe('VALIDO');
      const versiones = await flujo.base.db.query<{ version: number; origen: string }>(
        "SELECT version, origen FROM documentos WHERE id_solicitud=$1 AND tipo_documento='paz_y_salvo_bib' ORDER BY version",
        [id],
      );
      expect(versiones.rows).toEqual([
        { version: 1, origen: 'CONSULTA' },
        { version: 2, origen: 'CONSULTA' },
      ]);
    });

    it('un Paz y Salvo en PDF de antes de la Tarea 50 se vuelve a consultar como versión 2', async () => {
      const id = await conDeuda();
      // Simula una solicitud enviada antes de la Tarea 50: la versión 1 era un PDF subido.
      await flujo.base.db.query(
        `UPDATE documentos SET origen='ARCHIVO', nombre_original='paz.pdf', mime_type='application/pdf', tamano_bytes=10
         WHERE id_solicitud=$1 AND tipo_documento='paz_y_salvo_bib'`,
        [id],
      );
      flujo.biblioteca.respuesta = 'paz_y_salvo';
      await reconsultar(id).expect(201);
      const versiones = await flujo.base.db.query<{ version: number; origen: string }>(
        "SELECT version, origen FROM documentos WHERE id_solicitud=$1 AND tipo_documento='paz_y_salvo_bib' ORDER BY version",
        [id],
      );
      expect(versiones.rows).toEqual([
        { version: 1, origen: 'ARCHIVO' },
        { version: 2, origen: 'CONSULTA' },
      ]);
      expect((await documentosActuales(flujo, id)).paz_y_salvo_bib.estado).toBe('VALIDO');
    });

    it('la misma clave dos veces crea una sola entrega', async () => {
      const id = await conDeuda();
      await reconsultar(id, 'reconsulta-repetida').expect(201);
      await reconsultar(id, 'reconsulta-repetida').expect(201);
      expect(await entregas(id)).toBe(2);
      expect(flujo.biblioteca.llamadas).toBe(2);
    });

    it('cuenta en el límite de 3 reenvíos del día', async () => {
      const id = await conDeuda();
      for (let i = 0; i < 3; i++) await reconsultar(id).expect(201);
      const r = await reconsultar(id).expect(409);
      expect(r.body.message).toContain('Alcanzaste los tres reenvíos de hoy');
    });

    it('desde fecha_fin − 6 ya no se puede consultar de nuevo', async () => {
      const id = await conDeuda();
      await flujo.base.db.query(
        `UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+6`,
      );
      const r = await reconsultar(id).expect(409);
      expect(r.body.message).toContain('El plazo para corregir documentos terminó');
    });

    it('un Paz y Salvo VALIDO no se vuelve a consultar', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const r = await reconsultar(envio.body.id_solicitud).expect(403);
      expect(r.body.message).toBe('No se permite reemplazar un documento válido.');
    });

    it('otro estudiante no puede consultar una solicitud ajena', async () => {
      const id = await conDeuda();
      await flujo.base.db.query(
        "INSERT INTO usuarios(id_usuario,nombres,apellidos,correo,rol,codigo_estudiante) VALUES(950,'Otra','Persona','otra50@example.org','ESTUDIANTE','T00000950') ON CONFLICT DO NOTHING",
      );
      await flujo.base.db.query('UPDATE solicitud_grado SET id_estudiante=950 WHERE id_solicitud=$1', [id]);
      await reconsultar(id).expect(404);
    });

    it('la funcionaria consulta de nuevo sin gastar intentos del estudiante', async () => {
      const id = await conDeuda();
      flujo.biblioteca.respuesta = 'paz_y_salvo';
      const r = await reconsultarFuncionaria(id).expect(201);
      expect(r.body).toEqual({ ok: true, estadoSolicitud: 'VALIDA' });
      expect(await usados()).toBe(0);
      expect(await entregas(id)).toBe(1);
      const docs = await documentosActuales(flujo, id);
      expect(docs.paz_y_salvo_bib.estado).toBe('VALIDO');
    });

    it('la funcionaria no consulta una solicitud decidida y un estudiante no usa su ruta', async () => {
      const id = await conDeuda();
      await reconsultarFuncionaria(id, flujo.estudiante).expect(403);
      await flujo.funcionaria
        .post(`/api/funcionario/solicitudes/${id}/revisiones`)
        .send({ accion: 'anulada' })
        .expect(201);
      const r = await reconsultarFuncionaria(id).expect(409);
      expect(r.body.message).toBe('La solicitud ya fue decidida.');
    });
  });

  describe('reenvíos', () => {
    /** Envía con Saber Pro no válido y devuelve el id de la solicitud y el del documento. */
    async function conSaberProInvalido() {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      return { id, docs, saberPro: docs.saber_pro.id_documento };
    }
    async function moverFin(dias: number) {
      await flujo.base.db.query(
        `UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+$1::int`,
        [dias],
      );
    }
    async function entregas(id: number) {
      const r = await flujo.base.db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM entregas WHERE id_solicitud=$1',
        [id],
      );
      return r.rows[0].n;
    }

    it('el día fecha_fin − 7 todavía se puede reenviar', async () => {
      const { id, saberPro } = await conSaberProInvalido();
      await moverFin(7);
      await reenviar(flujo, id, [saberPro]).expect(201);
    });

    it('desde fecha_fin − 6 el reenvío se rechaza y no crea entrega', async () => {
      const { id, saberPro } = await conSaberProInvalido();
      await moverFin(6);
      const corte = (
        await flujo.base.db.query<{ corte: string }>(
          `SELECT (fecha_fin-7)::text AS corte FROM periodos_grado`,
        )
      ).rows[0].corte;
      const r = await reenviar(flujo, id, [saberPro]).expect(409);
      expect(r.body.message).toBe(
        `El plazo para corregir documentos terminó el ${corte}.`,
      );
      expect(await entregas(id)).toBe(1);
      const analisis = await flujo.estudiante
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      expect(analisis.body.fechaCorteCorreccion).toBe(corte);
      expect(
        analisis.body.documentos.every(
          (d: { resubmission_allowed: boolean }) => !d.resubmission_allowed,
        ),
      ).toBe(true);
    });

    it('el 4.º reenvío del día se rechaza con un mensaje claro', async () => {
      const { id } = await conSaberProInvalido();
      for (let i = 0; i < 3; i++) {
        const docs = await documentosActuales(flujo, id);
        await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(201);
      }
      const docs = await documentosActuales(flujo, id);
      const r = await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(
        409,
      );
      expect(r.body.message).toContain('Alcanzaste los tres reenvíos de hoy');
    });

    it('un documento VALIDO no se puede reenviar', async () => {
      const { id, docs } = await conSaberProInvalido();
      await reenviar(flujo, id, [docs.identification.id_documento]).expect(403);
    });

    it('un documento POR_REVISAR sí se puede reenviar', async () => {
      // Tarea 50: Paz y Salvo ya no se sube; se usa un documento con archivo por revisar.
      flujo.clasificacion.saber_pro = 'to_check';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      expect(envio.body.estado).toBe('POR_REVISAR');
      const docs = await documentosActuales(flujo, id);
      flujo.clasificacion.saber_pro = 'valid';
      const r = await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(
        201,
      );
      expect(r.body.estado).toBe('VALIDA');
    });

    it('el Paz y Salvo no se reenvía como archivo', async () => {
      flujo.biblioteca.respuesta = 'con_deuda';
      const envio = await enviar(flujo).expect(201);
      const docs = await documentosActuales(flujo, envio.body.id_solicitud);
      const r = await reenviar(flujo, envio.body.id_solicitud, [
        docs.paz_y_salvo_bib.id_documento,
      ]).expect(400);
      expect(r.body.message).toBe(
        'Paz y Salvo se consulta automáticamente con Biblioteca; no se sube.',
      );
    });

    it('un error técnico del motor no consume un reenvío', async () => {
      const { id, saberPro } = await conSaberProInvalido();
      flujo.motor.estado = 500;
      const r = await reenviar(flujo, id, [saberPro]);
      expect(r.status).toBeGreaterThanOrEqual(500);
      expect(await entregas(id)).toBe(1);
      const analisis = await flujo.estudiante
        .get('/api/estudiante/solicitud/analisis')
        .expect(200);
      expect(analisis.body.politicaReenvios.usados).toBe(0);
    });
  });

  describe('funcionaria', () => {
    function decidir(id: number, accion: string) {
      return flujo.funcionaria
        .post(`/api/funcionario/solicitudes/${id}/revisiones`)
        .send({ accion });
    }
    function resolver(
      idDocumento: number,
      body: Record<string, unknown>,
      agente = flujo.funcionaria,
    ) {
      return agente
        .post(`/api/funcionario/documentos/${idDocumento}/resolucion`)
        .send(body);
    }
    async function revisiones(id: number) {
      const r = await flujo.base.db.query<{ resultado: string }>(
        'SELECT resultado FROM revisiones WHERE id_solicitud=$1',
        [id],
      );
      return r.rows.map((f) => f.resultado);
    }
    /** Envía con Paz y Salvo sin respuesta de Biblioteca: queda un documento por revisar. */
    async function conPazYSalvoPorRevisar() {
      flujo.biblioteca.respuesta = 'sin_respuesta';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      return { id, envio, docs, paz: docs.paz_y_salvo_bib.id_documento };
    }

    it('aceptar una solicitud marcada NO_VALIDA la deja ACEPTADA y registra la revisión', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      await decidir(id, 'aceptada').expect(201);
      expect(await revisiones(id)).toEqual(['APROBADA']);
      expect(await estadoSolicitud(flujo, id)).toBe('ACEPTADA');
    });

    it('aceptar una VALIDA la deja ACEPTADA y bloquea reenvíos y otra decisión', async () => {
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      await decidir(id, 'aceptada').expect(201);
      expect(await estadoSolicitud(flujo, id)).toBe('ACEPTADA');
      const docs = await documentosActuales(flujo, id);
      const r = await reenviar(flujo, id, [docs.saber_pro.id_documento]).expect(
        409,
      );
      expect(r.body.message).toBe(
        'La solicitud no admite correcciones en su estado actual.',
      );
      await decidir(id, 'anulada').expect(409);
    });

    it('a una solicitud VALIDA no se le pide corrección, pero se puede anular', async () => {
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      await flujo.funcionaria
        .post(`/api/funcionario/solicitudes/${id}/revisiones`)
        .send({ accion: 'recarga', documentos: [docs.saber_pro.id_documento] })
        .expect(409);
      await decidir(id, 'anulada').expect(201);
      expect(await estadoSolicitud(flujo, id)).toBe('CERRADA');
    });

    it('marcar válido el único documento por revisar deja la solicitud VALIDA y avisa', async () => {
      const { id, envio, paz } = await conPazYSalvoPorRevisar();
      expect(envio.body.estado).toBe('POR_REVISAR');
      const r = await resolver(paz, { resultado: 'VALIDO' }).expect(201);
      expect(r.body).toEqual({ ok: true, estadoSolicitud: 'VALIDA' });
      expect(await estadoSolicitud(flujo, id)).toBe('VALIDA');
      const n = (
        await flujo.estudiante.get('/api/estudiante/notificaciones').expect(200)
      ).body.notificaciones;
      expect(n[0]).toMatchObject({
        tipo: 'success',
        titulo: 'Documento validado',
        generado_por: 'funcionario',
      });
      const detalle = await flujo.funcionaria
        .get(`/api/funcionario/solicitudes/${id}`)
        .expect(200);
      const doc = detalle.body.documentos.find(
        (d: { tipo: string }) => d.tipo === 'paz_y_salvo_bib',
      );
      expect(doc.estado).toBe('VALIDO');
      expect(doc.resultados[0].mensaje).toContain('funcionaria');
      expect(await revisiones(id)).toEqual(['DOCUMENTO_RESUELTO']);
    });

    it('marcar no válido exige comentario y deja NO_VALIDA', async () => {
      const { id, paz } = await conPazYSalvoPorRevisar();
      await resolver(paz, { resultado: 'NO_VALIDO' }).expect(400);
      await resolver(paz, { resultado: 'NO_VALIDO', comentario: '   ' }).expect(
        400,
      );
      await resolver(paz, { resultado: 'OTRO', comentario: 'x' }).expect(400);
      await resolver(paz, {
        resultado: 'NO_VALIDO',
        comentario: 'x'.repeat(5001),
      }).expect(400);
      await resolver(paz, {
        resultado: 'NO_VALIDO',
        comentario: 'El certificado no corresponde al estudiante.',
      }).expect(201);
      expect(await estadoSolicitud(flujo, id)).toBe('NO_VALIDA');
      const n = (
        await flujo.estudiante.get('/api/estudiante/notificaciones').expect(200)
      ).body.notificaciones;
      expect(n[0].msg).toContain(
        'El certificado no corresponde al estudiante.',
      );
    });

    it('resolver una versión vieja, un documento VALIDO o uno inexistente se rechaza', async () => {
      // Tarea 50: la versión vieja es la de un documento con archivo (Paz y Salvo no se reenvía).
      flujo.clasificacion.saber_pro = 'to_check';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      const viejo = docs.saber_pro.id_documento;
      await reenviar(flujo, id, [viejo]).expect(201);
      const r = await resolver(viejo, { resultado: 'VALIDO' }).expect(409);
      expect(r.body.message).toBe(
        'El documento ya no está por revisar o no es la versión actual.',
      );
      await resolver(docs.identification.id_documento, {
        resultado: 'VALIDO',
      }).expect(409);
      await resolver(999999, { resultado: 'VALIDO' }).expect(404);
    });

    // Tarea 50 (opción A de Héctor): un Paz y Salvo Inconsistente con ALMA lo puede resolver la funcionaria.
    it('la funcionaria resuelve un Paz y Salvo Inconsistente y la solicitud se recalcula', async () => {
      flujo.biblioteca.respuesta = 'inconsistente';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const paz = (await documentosActuales(flujo, id)).paz_y_salvo_bib;
      expect(paz.estado).toBe('INCONSISTENTE');
      const r = await resolver(paz.id_documento, {
        resultado: 'VALIDO',
        comentario: 'El nombre en Biblioteca tiene una tilde distinta; es la misma persona.',
      }).expect(201);
      expect(r.body.estadoSolicitud).toBe('VALIDA');
      expect((await documentosActuales(flujo, id)).paz_y_salvo_bib.estado).toBe('VALIDO');
      const historial = await flujo.base.db.query<{ estado_anterior: string; estado_nuevo: string }>(
        `SELECT h.estado_anterior, h.estado_nuevo FROM historial_validaciones h
         JOIN validaciones v ON v.id_validacion=h.id_validacion
         WHERE v.id_documento=$1 AND v.tipo_validacion='MANUAL'`,
        [paz.id_documento],
      );
      expect(historial.rows).toEqual([{ estado_anterior: 'INCONSISTENTE', estado_nuevo: 'VALIDO' }]);
    });

    it('un documento Inconsistente que no es Paz y Salvo sigue sin resolverse a mano', async () => {
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const saber = (await documentosActuales(flujo, id)).saber_pro.id_documento;
      await flujo.base.db.query("UPDATE documentos SET estado='INCONSISTENTE' WHERE id_documento=$1", [saber]);
      const r = await resolver(saber, { resultado: 'VALIDO' }).expect(409);
      expect(r.body.message).toBe(
        'El documento ya no está por revisar o no es la versión actual.',
      );
    });

    it('una solicitud decidida no admite resoluciones', async () => {
      const { id, paz } = await conPazYSalvoPorRevisar();
      await decidir(id, 'anulada').expect(201);
      const r = await resolver(paz, { resultado: 'VALIDO' }).expect(409);
      expect(r.body.message).toBe('La solicitud ya fue decidida.');
    });

    it('después de resolverlo, el detalle conserva el análisis del motor', async () => {
      flujo.clasificacion.saber_pro = 'to_check';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const doc = (await documentosActuales(flujo, id)).saber_pro;
      expect(doc.estado).toBe('POR_REVISAR');
      await resolver(doc.id_documento, { resultado: 'VALIDO' }).expect(201);
      const detalle = await flujo.funcionaria
        .get(`/api/funcionario/solicitudes/${id}`)
        .expect(200);
      const saber = detalle.body.documentos.find(
        (d: { tipo: string }) => d.tipo === 'saber_pro',
      );
      expect(saber.analisis.validation_version).toBe('prueba@1');
      expect(saber.resultados[0].mensaje).toContain('funcionaria');
    });

    it('un estudiante no puede resolver documentos', async () => {
      const { paz } = await conPazYSalvoPorRevisar();
      await resolver(paz, { resultado: 'VALIDO' }, flujo.estudiante).expect(
        403,
      );
    });
  });

  describe('barrido de plazos', () => {
    const plazos = () => flujo.app.get(PlazosSolicitudService);
    /**
     * Inserta una solicitud del estudiante 1 en el periodo de prueba, sin documentos. Su estado se
     * calculó hace 10 días, es decir, antes de que venciera el plazo.
     */
    async function solicitud(estado: string, nivel = 'PREGRADO') {
      const r = await flujo.base.db.query<{ id: number }>(
        `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo,fecha_actualizacion)
        VALUES(1,$1,$2,$3,CURRENT_TIMESTAMP - interval '10 days') RETURNING id_solicitud AS id`,
        [nivel, estado, PERIODO],
      );
      return r.rows[0].id;
    }
    async function moverFin(dias: number) {
      await flujo.base.db.query(
        `UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+$1::int`,
        [dias],
      );
    }
    async function avisos(id: number) {
      const r = await flujo.base.db.query<Record<string, string>>(
        'SELECT tipo,titulo,generado_por FROM notificaciones WHERE solicitud_id=$1',
        [id],
      );
      return r.rows;
    }

    it('recalcula una solicitud vieja EN_PROCESO con sus documentos válidos', async () => {
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      await flujo.base.db.query(
        "UPDATE solicitud_grado SET estado='EN_PROCESO' WHERE id_solicitud=$1",
        [id],
      );
      await expect(plazos().ejecutar()).resolves.toMatchObject({
        recalculadas: 1,
      });
      expect(await estadoSolicitud(flujo, id)).toBe('VALIDA');
    });

    it('una EN_PROCESO sin documentos ni programas queda POR_REVISAR sin error', async () => {
      const id = await solicitud('EN_PROCESO');
      await plazos().ejecutar();
      expect(await estadoSolicitud(flujo, id)).toBe('POR_REVISAR');
    });

    it('al vencer fecha_fin − 7 anula las NO_VALIDA e INCONSISTENTE con un aviso, una sola vez', async () => {
      const noValida = await solicitud('NO_VALIDA');
      const inconsistente = await solicitud('INCONSISTENTE');
      const otras = await Promise.all(
        ['POR_REVISAR', 'VALIDA', 'ACEPTADA'].map((e) => solicitud(e)),
      );
      await moverFin(6);
      await expect(plazos().ejecutar()).resolves.toMatchObject({ anuladas: 2 });
      await plazos().ejecutar();
      for (const id of [noValida, inconsistente]) {
        expect(await estadoSolicitud(flujo, id)).toBe('CERRADA');
        expect(await avisos(id)).toEqual([
          {
            tipo: 'error',
            titulo: 'Solicitud anulada',
            generado_por: 'system',
          },
        ]);
      }
      expect(
        await Promise.all(otras.map((id) => estadoSolicitud(flujo, id))),
      ).toEqual(['POR_REVISAR', 'VALIDA', 'ACEPTADA']);
    });

    it('una POR_REVISAR por corrección pedida y nunca corregida se anula si sus documentos no son válidos', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      await flujo.funcionaria
        .post(`/api/funcionario/solicitudes/${id}/revisiones`)
        .send({ accion: 'recarga', documentos: [docs.saber_pro.id_documento] })
        .expect(201);
      expect(await estadoSolicitud(flujo, id)).toBe('POR_REVISAR');
      await flujo.base.db.query(
        "UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date-1",
      );
      // El cambio de estado fue hace días: el plazo venció después.
      await flujo.base.db.query(
        'ALTER TABLE solicitud_grado DISABLE TRIGGER trg_solicitud_fecha_actualizacion',
      );
      await flujo.base.db.query(
        "UPDATE solicitud_grado SET fecha_actualizacion=CURRENT_TIMESTAMP - interval '10 days' WHERE id_solicitud=$1",
        [id],
      );
      await flujo.base.db.query(
        'ALTER TABLE solicitud_grado ENABLE TRIGGER trg_solicitud_fecha_actualizacion',
      );
      await expect(plazos().ejecutar()).resolves.toMatchObject({ anuladas: 1 });
      expect(await estadoSolicitud(flujo, id)).toBe('CERRADA');
    });

    it('una POR_REVISAR con algo de verdad por revisar no se anula al cierre', async () => {
      const id = await solicitud('POR_REVISAR');
      await moverFin(6);
      await expect(plazos().ejecutar()).resolves.toMatchObject({ anuladas: 0 });
      expect(await estadoSolicitud(flujo, id)).toBe('POR_REVISAR');
    });

    it('una solicitud vieja recalculada después del vencimiento no se anula sola', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      await flujo.base.db.query(
        "UPDATE solicitud_grado SET estado='EN_PROCESO' WHERE id_solicitud=$1",
        [id],
      );
      await moverFin(3);
      await plazos().ejecutar();
      expect(await estadoSolicitud(flujo, id)).toBe('NO_VALIDA');
      await expect(plazos().ejecutar()).resolves.toMatchObject({ anuladas: 0 });
      expect(await estadoSolicitud(flujo, id)).toBe('NO_VALIDA');
    });

    it('pedir corrección después del plazo se rechaza', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const docs = await documentosActuales(flujo, id);
      await moverFin(6);
      const corte = (
        await flujo.base.db.query<{ corte: string }>(
          'SELECT (fecha_fin-7)::text AS corte FROM periodos_grado',
        )
      ).rows[0].corte;
      const r = await flujo.funcionaria
        .post(`/api/funcionario/solicitudes/${id}/revisiones`)
        .send({ accion: 'recarga', documentos: [docs.saber_pro.id_documento] })
        .expect(409);
      expect(r.body.message).toBe(
        `El plazo para corregir documentos terminó el ${corte}.`,
      );
    });

    it('el último día para corregir no anula nada', async () => {
      const id = await solicitud('NO_VALIDA');
      await moverFin(7);
      await expect(plazos().ejecutar()).resolves.toMatchObject({ anuladas: 0 });
      expect(await estadoSolicitud(flujo, id)).toBe('NO_VALIDA');
    });
  });

  describe('cancelación con el estado calculado (Tarea 44)', () => {
    async function solicitud(estado: string) {
      const r = await flujo.base.db.query<{ id: number }>(
        `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo)
        VALUES(1,'PREGRADO',$1,$2) RETURNING id_solicitud AS id`,
        [estado, PERIODO],
      );
      return r.rows[0].id;
    }
    const cancelar = (id: number) =>
      flujo.estudiante
        .post(`/api/estudiante/solicitudes/${id}/cancelacion`)
        .send({});

    it.each([
      'EN_PROCESO',
      'POR_REVISAR',
      'NO_VALIDA',
      'INCONSISTENTE',
      'VALIDA',
    ])(
      'una solicitud enviada sin decidir (%s) se puede cancelar y queda auditada',
      async (estado) => {
        const id = await solicitud(estado);
        const detalle = await flujo.estudiante
          .get(`/api/estudiante/solicitudes/${id}/analisis`)
          .expect(200);
        expect(detalle.body.cancelacion.permitida).toBe(true);
        await cancelar(id).expect(201);
        expect(await estadoSolicitud(flujo, id)).toBe('CANCELADA');
        const a = await flujo.base.db.query<{ estado_anterior: string }>(
          'SELECT estado_anterior FROM cancelaciones_preinscripcion WHERE id_solicitud=$1',
          [id],
        );
        expect(a.rows[0].estado_anterior).toBe(estado);
      },
    );

    it.each(['ACEPTADA', 'CERRADA'])(
      'una solicitud decidida (%s) no se cancela',
      async (estado) => {
        const id = await solicitud(estado);
        await cancelar(id).expect(409);
        expect(await estadoSolicitud(flujo, id)).toBe(estado);
      },
    );

    it('el barrido no recalcula ni anula una cancelada', async () => {
      const id = await solicitud('NO_VALIDA');
      await cancelar(id).expect(201);
      await flujo.base.db.query(
        `UPDATE periodos_grado SET fecha_fin=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date+1`,
      );
      await flujo.app.get(PlazosSolicitudService).ejecutar();
      expect(await estadoSolicitud(flujo, id)).toBe('CANCELADA');
    });
  });

  describe('listado del dashboard', () => {
    async function solicitudEnviada(estado: string, envio: string | null) {
      const r = await flujo.base.db.query<{ id: number }>(
        `INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud,estado,id_periodo)
        VALUES(1,'PREGRADO',$1,$2) RETURNING id_solicitud AS id`,
        [estado, PERIODO],
      );
      const id = r.rows[0].id;
      if (envio)
        await flujo.base.db.query(
          `INSERT INTO entregas(id_solicitud,numero_entrega,tipo_entrega,fecha_entrega) VALUES($1,1,'INICIAL',$2)`,
          [id, envio],
        );
      return id;
    }

    it('excluye borradores y trae la fecha del primer envío en hora de Bogotá', async () => {
      await solicitudEnviada('BORRADOR', null);
      const noche = await solicitudEnviada('VALIDA', '2026-11-01T01:00:00Z');
      const manana = await solicitudEnviada(
        'NO_VALIDA',
        '2026-10-30T14:00:00Z',
      );
      const r = await flujo.funcionaria
        .get('/api/funcionario/solicitudes')
        .expect(200);
      expect(
        r.body.map((s: { id: string; fechaEnvio: string; envioEn: string }) => [
          s.id,
          s.fechaEnvio,
          s.envioEn,
        ]),
      ).toEqual([
        [String(noche), '2026-10-31', '2026-11-01T01:00:00.000Z'],
        [String(manana), '2026-10-30', '2026-10-30T14:00:00.000Z'],
      ]);
      expect(r.body[0]).toMatchObject({
        estado: 'VALIDA',
        nivel: 'PREGRADO',
        periodId: PERIODO,
        estudiante: expect.any(String),
      });
    });

    it('una solicitud vieja sin entrega aparece al final, sin fecha de envío', async () => {
      const vieja = await solicitudEnviada('EN_PROCESO', null);
      const enviada = await solicitudEnviada('VALIDA', '2026-10-30T14:00:00Z');
      const r = await flujo.funcionaria
        .get('/api/funcionario/solicitudes')
        .expect(200);
      expect(r.body.map((s: { id: string }) => s.id)).toEqual([
        String(enviada),
        String(vieja),
      ]);
      expect(r.body[1]).toMatchObject({ fechaEnvio: null, envioEn: null });
    });
  });
});
