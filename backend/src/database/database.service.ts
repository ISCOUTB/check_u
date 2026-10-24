
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private pool?: Pool;

  async onModuleInit(): Promise<void> {
    const host = process.env.DB_HOST;

    // Permite iniciar el backend en entornos sin DB configurada.
    if (!host) {
      this.logger.warn('PostgreSQL no configurado; conexión omitida.');
      return;
    }

    this.pool = new Pool({
      host,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'checku',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME ?? 'checku_local',
      connectionTimeoutMillis: 5000,
    });

    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Conexión con PostgreSQL establecida.');
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('PostgreSQL no está configurado.');
    }
    return this.pool.query<T>(sql, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
