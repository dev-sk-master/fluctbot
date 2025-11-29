import { registerAs } from '@nestjs/config';

export interface SwaggerConfig {
  enabled: boolean;
  title: string;
  description: string;
  version: string;
  path: string;
}

export const swaggerConfig = registerAs(
  'swagger',
  (): SwaggerConfig => ({
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: process.env.SWAGGER_TITLE || 'FluctBot API',
    description: process.env.SWAGGER_DESCRIPTION || 'FluctBot API Documentation',
    version: process.env.SWAGGER_VERSION || '1.0',
    path: process.env.SWAGGER_PATH || 'api/docs',
  }),
);

