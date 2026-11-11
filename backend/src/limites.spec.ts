import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth/auth.controller.js';
import { limiteCargas, opcionesLimites, saltosDeProxy } from './limites.js';
import { SolicitudesController } from './solicitudes/solicitudes.controller.js';

// @nestjs/throttler no exporta sus constantes; el guard lee `THROTTLER:SKIP` + el nombre del limitador.
const CLAVE_OMITIR_DEFAULT = 'THROTTLER:SKIPdefault';

/** Lee un método del prototipo sin referenciarlo directamente (evita unbound-method). */
function metodoDe(prototipo: object, nombre: string): object {
  return Reflect.get(prototipo, nombre) as object;
}

// Con los límites de producción (no los de prueba): el de cargas no debe aplicarse a las demás rutas.
@Controller()
class RutasDePrueba {
  @Get('consulta')
  consultar() {
    return { ok: true };
  }

  @Post('carga')
  @Throttle(limiteCargas(false))
  cargar() {
    return { ok: true };
  }
}

async function crearApp(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot(opcionesLimites(false))],
    controllers: [RutasDePrueba],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();
  const app = modulo.createNestApplication();
  await app.init();
  return app;
}

async function estados(app: INestApplication, metodo: 'get' | 'post', ruta: string, veces: number) {
  const codigos: number[] = [];
  for (let i = 0; i < veces; i++) codigos.push((await request(app.getHttpServer())[metodo](ruta)).status);
  return codigos;
}

describe('límites de frecuencia', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('una ruta sin límite propio admite 60 peticiones por minuto, no 8', async () => {
    const codigos = await estados(app, 'get', '/consulta', 61);
    expect(codigos.slice(0, 60).every((c) => c === 200)).toBe(true);
    expect(codigos[60]).toBe(429);
  });

  it('una ruta de carga admite 8 peticiones por minuto', async () => {
    const codigos = await estados(app, 'post', '/carga', 9);
    expect(codigos.slice(0, 8).every((c) => c === 201)).toBe(true);
    expect(codigos[8]).toBe(429);
  });

  it('el envío de la preinscripción no repite el guard global, que contaría cada envío dos veces', () => {
    const guards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        metodoDe(SolicitudesController.prototype, 'enviarPreinscripcion'),
      ) ?? [];
    expect(guards).not.toContain(ThrottlerGuard);
  });

  it('la consulta de sesión queda fuera del límite general', () => {
    const omitido = Reflect.getMetadata(
      CLAVE_OMITIR_DEFAULT,
      metodoDe(AuthController.prototype, 'me'),
    );
    expect(omitido).toBe(true);
  });

  it('el inicio de sesión sigue sujeto al límite general', () => {
    const omitido = Reflect.getMetadata(
      CLAVE_OMITIR_DEFAULT,
      metodoDe(AuthController.prototype, 'login'),
    );
    expect(omitido).toBeUndefined();
  });

  it('confía en un salto de proxy por defecto y permite ajustarlo con TRUST_PROXY', () => {
    expect(saltosDeProxy('1')).toBe(1);
    expect(saltosDeProxy('2')).toBe(2);
    expect(saltosDeProxy('0')).toBe(0);
    expect(saltosDeProxy('')).toBe(1);
    expect(saltosDeProxy('no-es-numero')).toBe(1);
    expect(saltosDeProxy('-1')).toBe(1);
  });
});
