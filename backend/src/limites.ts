import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/** En las pruebas automáticas los límites no deben interferir. */
export const ES_TEST =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  !!process.env.VITEST_WORKER_ID;

const VENTANA_MS = 60_000;

/**
 * Límite general por ruta e IP que registra AppModule. Es el único limitador con nombre:
 * el guard global aplica a todas las rutas cada limitador de esta lista, así que un segundo
 * limitador de 8 por minuto bloquearía también las consultas normales.
 */
export function opcionesLimites(esTest = ES_TEST): ThrottlerModuleOptions {
  return [{ name: 'default', ttl: VENTANA_MS, limit: esTest ? 10_000 : 60 }];
}

/** Para `@Throttle` en las rutas que reciben archivos: baja el límite general a 8 por minuto. */
export function limiteCargas(esTest = ES_TEST) {
  return { default: { limit: esTest ? 10_000 : 8, ttl: VENTANA_MS } };
}
