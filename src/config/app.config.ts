import { registerAs } from '@nestjs/config';

export interface AppConfig {
  name: string;
  port: number;
  env: string;
  apiPrefix: string;
  corsOrigins: string[];
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    name: process.env.APP_NAME || 'FluctBot',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000'],
  }),
);

