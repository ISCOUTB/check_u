import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { Module } from '@nestjs/common';
import { EstudiantesModule } from './estudiantes/estudiantes.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentosModule } from './documentos/documentos.module.js';
import { OpcionesModule } from './opciones/opciones.module.js';
import { PeriodosModule } from './periodos/periodos.module.js';
import { modulosDeObservabilidad } from './observabilidad.js';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core/constants.js';
import { opcionesLimites } from './limites.js';

export { ObserveModule, ObserveInstrument } from './observabilidad.js';

@Module({
  imports: [
    ThrottlerModule.forRoot(opcionesLimites()),

    // Observe solo se activa con OBSERVE_APP_KEY y OBSERVE_APP_SECRET (ver observabilidad.ts).
    ...modulosDeObservabilidad(),
    AuthModule,
    EstudiantesModule,
    DatabaseModule,
    DocumentosModule,
    OpcionesModule,
    PeriodosModule,
    SolicitudesModule,
    NotificacionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
