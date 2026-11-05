import {
  BibliotecaMotorService,
  BibliotecaService,
  consultarConLimite,
  estadoDocumentoBiblioteca,
  SIN_RESPUESTA,
  type EstudianteBiblioteca,
} from './biblioteca.service.js';

const ESTUDIANTE: EstudianteBiblioteca = {
  codigo: 'T00000901',
  numeroDocumento: '1000000901',
  nombres: 'Ana',
  apellidos: 'Prueba',
};

/** Resultado con la forma que devuelve el motor (modules/validadores/fuentes/alma). */
function resultado(estado: string, extra: Record<string, unknown> = {}) {
  return {
    user_id: 'T00000901',
    estado,
    paz_y_salvo:
      estado === 'cumple' ? true : estado === 'no_cumple' ? false : null,
    consultado_en: '2026-11-04T10:00:00-05:00',
    valido_hasta: null,
    criterios: {},
    acciones_requeridas: [],
    mensaje: 'Mensaje de prueba.',
    fuente: 'alma_simulada',
    identidad: { coincide: true, campos_distintos: [] },
    ...extra,
  };
}

const con = (consultar: BibliotecaService['consultar']) =>
  ({ consultar }) as BibliotecaService;

describe('estadoDocumentoBiblioteca', () => {
  it.each([
    ['cumple', 'VALIDO'],
    ['no_cumple', 'NO_VALIDO'],
    ['inconsistente', 'INCONSISTENTE'],
    ['no_evaluable', 'POR_REVISAR'],
    ['no_encontrado', 'POR_REVISAR'],
  ])('%s deja el documento %s', (estado, esperado) => {
    expect(
      estadoDocumentoBiblioteca(
        resultado(estado) as Parameters<typeof estadoDocumentoBiblioteca>[0],
      ),
    ).toBe(esperado);
  });
});

describe('consultarConLimite: Biblioteca nunca tumba ni bloquea el envío', () => {
  afterEach(() => vi.useRealTimers());

  it('devuelve el resultado del motor', async () => {
    const r = await consultarConLimite(
      con(() => Promise.resolve(resultado('no_cumple'))),
      ESTUDIANTE,
    );
    expect(r.estado).toBe('no_cumple');
    expect(r.fuente).toBe('alma_simulada');
  });

  it('un rechazo o un error lanzado sin promesa quedan sin respuesta', async () => {
    await expect(
      consultarConLimite(
        con(() => Promise.reject(new Error('caída'))),
        ESTUDIANTE,
      ),
    ).resolves.toEqual(SIN_RESPUESTA);
    await expect(
      consultarConLimite(
        con(() => {
          throw new Error('síncrono');
        }),
        ESTUDIANTE,
      ),
    ).resolves.toEqual(SIN_RESPUESTA);
  });

  it('una respuesta con otra forma queda sin respuesta', async () => {
    await expect(
      consultarConLimite(
        con(() => Promise.resolve({ foo: 1 })),
        ESTUDIANTE,
      ),
    ).resolves.toEqual(SIN_RESPUESTA);
    await expect(
      consultarConLimite(
        con(() => Promise.resolve(resultado('tal_vez'))),
        ESTUDIANTE,
      ),
    ).resolves.toEqual(SIN_RESPUESTA);
  });

  it('si Biblioteca no contesta en el límite, queda sin respuesta', async () => {
    vi.useFakeTimers();
    const pendiente = consultarConLimite(
      con(() => new Promise(() => {})),
      ESTUDIANTE,
      5000,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pendiente).resolves.toEqual(SIN_RESPUESTA);
    expect(estadoDocumentoBiblioteca(SIN_RESPUESTA)).toBe('POR_REVISAR');
  });
});

describe('BibliotecaMotorService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta POST /biblioteca/paz-y-salvo del motor con la identidad de CheckU', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(resultado('cumple')));
    vi.stubGlobal('fetch', fetch);
    process.env.MOTOR_URL = 'http://motor.prueba:5001/';
    try {
      const r = await new BibliotecaMotorService().consultar(ESTUDIANTE);
      expect(r).toMatchObject({ estado: 'cumple' });
      const [url, opciones] = fetch.mock.calls[0];
      expect(url).toBe('http://motor.prueba:5001/biblioteca/paz-y-salvo');
      expect(opciones.method).toBe('POST');
      expect(JSON.parse(opciones.body)).toEqual({
        id_student: 'T00000901',
        identidad: {
          numero_documento: '1000000901',
          nombres: 'Ana',
          apellidos: 'Prueba',
        },
      });
    } finally {
      delete process.env.MOTOR_URL;
    }
  });

  it('un error HTTP del motor se propaga (consultarConLimite lo vuelve sin respuesta)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('falla', { status: 500 })),
    );
    await expect(
      new BibliotecaMotorService().consultar(ESTUDIANTE),
    ).rejects.toThrow();
  });
});
