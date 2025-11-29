import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { databaseConfig } from './database.config';
import { appConfig } from './app.config';
import { swaggerConfig } from './swagger.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, swaggerConfig],
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}

