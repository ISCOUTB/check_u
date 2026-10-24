import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { PeriodosModule } from './periodos/periodos.module.js';
import { modulosDeObservabilidad } from './observabilidad.js';

export { ObserveModule, ObserveInstrument } from './observabilidad.js';

@Module({
  imports: [
    // Observe solo se activa con OBSERVE_APP_KEY y OBSERVE_APP_SECRET (ver observabilidad.ts).
    ...modulosDeObservabilidad(),
    AuthModule,
    DatabaseModule,
    PeriodosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
