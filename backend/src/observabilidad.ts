import type { DynamicModule } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';

// Distributed tracing, auto-correlated logs, request/job metrics, error
// telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
export const { ObserveModule, ObserveInstrument } = createObserveModule();

/**
 * Observe solo se registra si existen OBSERVE_APP_KEY y OBSERVE_APP_SECRET en el entorno.
 * Sin ellas el backend arranca sin Observe; las claves nunca van en el código.
 */
export function modulosDeObservabilidad(env: NodeJS.ProcessEnv = process.env): DynamicModule[] {
  const appKey = env.OBSERVE_APP_KEY?.trim();
  const appSecret = env.OBSERVE_APP_SECRET?.trim();
  if (!appKey || !appSecret) return [];

  return [ObserveModule.forRoot({ appKey, appSecret, serviceId: 'backend' })];
}
