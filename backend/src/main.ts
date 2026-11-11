
import './entorno.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { saltosDeProxy } from './limites.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // En Dokploy el backend está detrás de un proxy. Sin esto, req.ip es la IP del proxy
  // y el límite de frecuencia se comparte entre todos los usuarios.
  app.set('trust proxy', saltosDeProxy());

  app.enableCors({
    origin: [
      'http://localhost:3001',
      'https://checku.iscoutb.dev',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();