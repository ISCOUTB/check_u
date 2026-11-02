import {
  BibliotecaDemoService,
  BibliotecaService,
  consultarConLimite,
} from './biblioteca.service.js';

describe('BibliotecaDemoService', () => {
  const servicio: BibliotecaService = new BibliotecaDemoService();

  it('el estudiante de prueba del equipo está a paz y salvo', async () => {
    await expect(servicio.consultarPazYSalvo('T00000001')).resolves.toBe(
      'paz_y_salvo',
    );
  });

  it('un código que no está en la lista tiene pendientes', async () => {
    await expect(servicio.consultarPazYSalvo('T00099999')).resolves.toBe(
      'con_deuda',
    );
  });

  it('un código vacío o con espacios no se confunde con uno de la lista', async () => {
    await expect(servicio.consultarPazYSalvo('')).resolves.toBe('con_deuda');
    await expect(servicio.consultarPazYSalvo(' T00000001 ')).resolves.toBe(
      'paz_y_salvo',
    );
  });
});

describe('consultarConLimite: Biblioteca nunca tumba ni bloquea el envío', () => {
  afterEach(() => vi.useRealTimers());
  const con = (consultarPazYSalvo: BibliotecaService['consultarPazYSalvo']) =>
    ({ consultarPazYSalvo }) as BibliotecaService;

  it('devuelve la respuesta de Biblioteca', async () => {
    await expect(
      consultarConLimite(
        con(() => Promise.resolve('con_deuda')),
        'T00000001',
      ),
    ).resolves.toBe('con_deuda');
  });

  it('un rechazo o un error lanzado sin promesa quedan sin_respuesta', async () => {
    await expect(
      consultarConLimite(
        con(() => Promise.reject(new Error('caída'))),
        'T1',
      ),
    ).resolves.toBe('sin_respuesta');
    await expect(
      consultarConLimite(
        con(() => {
          throw new Error('síncrono');
        }),
        'T1',
      ),
    ).resolves.toBe('sin_respuesta');
  });

  it('una respuesta desconocida queda sin_respuesta', async () => {
    await expect(
      consultarConLimite(
        con(() => Promise.resolve('tal_vez' as unknown as 'paz_y_salvo')),
        'T1',
      ),
    ).resolves.toBe('sin_respuesta');
  });

  it('si Biblioteca no contesta en el límite, queda sin_respuesta', async () => {
    vi.useFakeTimers();
    const pendiente = consultarConLimite(
      con(() => new Promise(() => {})),
      'T1',
      5000,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pendiente).resolves.toBe('sin_respuesta');
  });
});
