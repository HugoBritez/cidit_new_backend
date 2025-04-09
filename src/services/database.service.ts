import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { getDatabaseConfig } from '../config/database.config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection: mysql.Connection;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const config = getDatabaseConfig(this.configService);
    this.connection = await mysql.createConnection(config);
  }

  async onModuleDestroy() {
    await this.connection.end();
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    try {
      const [results] = await this.connection.execute(sql, params);
      return results as T;
    } catch (error) {
      console.error('Error ejecutando consulta SQL:', error);
      throw error;
    }
  }

  async transaction<T>(callback: (connection: mysql.Connection) => Promise<T>): Promise<T> {
    await this.connection.beginTransaction();
    try {
      const result = await callback(this.connection);
      await this.connection.commit();
      return result;
    } catch (error) {
      await this.connection.rollback();
      throw error;
    }
  }
} 