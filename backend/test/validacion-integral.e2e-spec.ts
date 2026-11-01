import { crearDbBorrador } from './soporte/db-borrador.js';
import {
  documentosActuales,
  enviar,
  estadoSolicitud,
  montarFlujo,
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
        void estadoSolicitud;
      },
    );
  });
});
