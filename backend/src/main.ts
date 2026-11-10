import './entorno.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarSeguridadHttp } from './seguridad-http.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  configurarSeguridadHttp(app);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
