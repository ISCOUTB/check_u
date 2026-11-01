import {
  BibliotecaDemoService,
  BibliotecaService,
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
