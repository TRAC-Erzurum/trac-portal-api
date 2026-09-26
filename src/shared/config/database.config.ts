import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
    // Columns are `timestamp` (no tz) and hold UTC wall time; `DEFAULT now()`
    // follows the session timezone, so pin it instead of inheriting the server's.
    extra: { options: '-c timezone=UTC' },
    migrations: ['dist/migrations/*{.ts,.js}'],
    entities: ['dist/**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  }),
);
