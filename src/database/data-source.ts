import { DataSource, DataSourceOptions } from 'typeorm';
import { join, resolve } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
// This is needed because TypeORM CLI runs outside of NestJS context
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fluctbot',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(process.cwd(), 'migrations/*{.ts,.js}')],
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : undefined,
};

export default new DataSource(databaseConfig);

