import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config/app.config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello() {
    const appConfig = this.configService.get<AppConfig>('app')!;
    return {
      message: `Welcome to ${appConfig.name} API`,
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }
}
