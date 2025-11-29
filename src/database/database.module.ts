import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }
        return {
          type: dbConfig.type,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          // Migrations are only used by TypeORM CLI, not at runtime
          // migrations: [process.cwd() + '/migrations/*{.ts,.js}'],
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          ssl: dbConfig.ssl,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

