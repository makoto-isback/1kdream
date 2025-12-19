import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      // Check for users.isActivated and users.activatedAt columns
      const columns = await this.dataSource.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name IN ('isActivated', 'activatedAt')
        `
      );

      const columnNames = (columns || []).map((c: any) => c.column_name);

      if (columnNames.includes('isActivated')) {
        this.logger.log('✅ [DB] users.isActivated column detected');
      } else {
        this.logger.warn('⚠️ [DB] users.isActivated column NOT found');
      }

      if (columnNames.includes('activatedAt')) {
        this.logger.log('✅ [DB] users.activatedAt column detected');
      } else {
        this.logger.warn('⚠️ [DB] users.activatedAt column NOT found');
      }

      // Check for usdt_withdrawals table
      const tables = await this.dataSource.query(
        `
        SELECT to_regclass('public.usdt_withdrawals') AS table_name
        `
      );

      const tableName = tables && tables[0] && tables[0].table_name;

      if (tableName) {
        this.logger.log('✅ [DB] usdt_withdrawals table detected');
      } else {
        this.logger.warn('⚠️ [DB] usdt_withdrawals table NOT found');
      }
    } catch (error) {
      this.logger.error('❌ [DB] Error during schema health check', error?.message || error);
    }
  }
}


