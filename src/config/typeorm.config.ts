import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config(); // Load .env file

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  // Run each migration in its own transaction, as run-migrations.ts does, so new enum values are committed before use.
  migrationsTransactionMode: 'each',
  ssl: process.env.DB_SSL === 'true',
  extra: { options: '-c timezone=UTC' },
  // TypeORM 1.x throws on null/undefined where values by default; keep the 0.3 behaviour (ignore).
  invalidWhereValuesBehavior: { null: 'ignore', undefined: 'ignore' },
});
