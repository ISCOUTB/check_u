import { crearDbBorrador } from './soporte/db-borrador.js';
import {
  documentosActuales,
  enviar,
  estadoSolicitud,
  montarFlujo,
  reenviar,
  reiniciar,
  type Flujo,
} from './soporte/flujo-tarea42.js';

const PERIODO = '11111111-1111-4111-8111-111111111111';

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

  it('la resolución exige exactamente un documento', async () => {
    const { solicitud, documento } = await solicitudConDocumento('VALIDO');
    await expect(resolver(solicitud, [])).rejects.toThrow(/un documento/);
    await expect(resolver(solicitud, [documento, documento])).rejects.toThrow(
      /un documento/,
    );
  });
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

  describe('Paz y Salvo', () => {
    it.each([
      ['paz_y_salvo', 'VALIDO'],
      ['con_deuda', 'NO_VALIDO'],
      ['error', 'POR_REVISAR'],
    ] as const)(
      'Biblioteca responde %s: el documento queda %s y el envío se completa',
      async (respuesta, esperado) => {
        flujo.biblioteca.respuesta = respuesta;
        const envio = await enviar(flujo).expect(201);
        const docs = await documentosActuales(flujo, envio.body.id_solicitud);
        expect(docs.paz_y_salvo_bib.estado).toBe(esperado);
        expect(flujo.motor.llamadas).not.toContain('paz_y_salvo_bib');
        const analisis = await flujo.estudiante
          .get('/api/estudiante/solicitud/analisis')
          .expect(200);
        const paz = analisis.body.documentos.find(
          (d: { tipo: string }) => d.tipo === 'paz_y_salvo_bib',
        );
        expect(paz.resultados[0].mensaje).not.toContain(
          'pendiente de integración',
        );
      },
    );
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
      flujo.biblioteca.respuesta = 'error';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      expect(envio.body.estado).toBe('POR_REVISAR');
      const docs = await documentosActuales(flujo, id);
      flujo.biblioteca.respuesta = 'paz_y_salvo';
      const r = await reenviar(flujo, id, [
        docs.paz_y_salvo_bib.id_documento,
      ]).expect(201);
      expect(r.body.estado).toBe('VALIDA');
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
});
