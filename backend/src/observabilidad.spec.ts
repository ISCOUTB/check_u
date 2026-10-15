import { modulosDeObservabilidad } from './observabilidad.js';

describe('modulosDeObservabilidad', () => {
  it('sin claves no registra Observe', () => {
    expect(modulosDeObservabilidad({})).toEqual([]);
  });

  it('con una sola de las dos claves tampoco', () => {
    expect(modulosDeObservabilidad({ OBSERVE_APP_KEY: 'clave' })).toEqual([]);
    expect(modulosDeObservabilidad({ OBSERVE_APP_SECRET: 'secreto' })).toEqual([]);
  });

  it('las claves en blanco cuentan como ausentes', () => {
    expect(modulosDeObservabilidad({ OBSERVE_APP_KEY: ' ', OBSERVE_APP_SECRET: '' })).toEqual([]);
  });

  it('con las dos claves registra el módulo de Observe', () => {
    expect(
      modulosDeObservabilidad({ OBSERVE_APP_KEY: 'clave', OBSERVE_APP_SECRET: 'secreto' }),
    ).toHaveLength(1);
  });
});
