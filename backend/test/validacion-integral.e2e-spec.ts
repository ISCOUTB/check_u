import { readFile } from 'node:fs/promises';
import { crearDbBorrador } from './soporte/db-borrador.js';
import { PlazosSolicitudService } from '../src/solicitudes/plazos-solicitud.service.js';
import {
  documentosActuales,
  enviar,
  estadoSolicitud,
  montarFlujo,
  PERIODO,
  reenviar,
  reiniciar,
  type Flujo,
} from './soporte/flujo-tarea42.js';

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
        new URL(
          '../../db/migrations/009-estado-solicitud.sql',
          import.meta.url,
        ),
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

    it('aceptar una solicitud que no es VALIDA responde 409 y no crea revisión', async () => {
      flujo.clasificacion.saber_pro = 'invalid';
      const envio = await enviar(flujo).expect(201);
      const id = envio.body.id_solicitud as number;
      const r = await decidir(id, 'aceptada').expect(409);
      expect(r.body.message).toBe(
        'Solo se puede aceptar una solicitud válida.',
      );
      expect(await revisiones(id)).toEqual([]);
      expect(await estadoSolicitud(flujo, id)).toBe('NO_VALIDA');
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
      const { id, docs, paz } = await conPazYSalvoPorRevisar();
      await reenviar(flujo, id, [paz]).expect(201);
      const r = await resolver(paz, { resultado: 'VALIDO' }).expect(409);
      expect(r.body.message).toBe(
        'El documento ya no está por revisar o no es la versión actual.',
      );
      await resolver(docs.identification.id_documento, {
        resultado: 'VALIDO',
      }).expect(409);
      await resolver(999999, { resultado: 'VALIDO' }).expect(404);
    });

    it('una solicitud decidida no admite resoluciones', async () => {
      const { id, paz } = await conPazYSalvoPorRevisar();
      await decidir(id, 'anulada').expect(201);
      const r = await resolver(paz, { resultado: 'VALIDO' }).expect(409);
      expect(r.body.message).toBe('La solicitud ya fue decidida.');
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
});
