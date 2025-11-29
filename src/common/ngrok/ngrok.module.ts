/**
 * Ngrok Module
 * Provides ngrok service for making local endpoints publicly accessible
 */

import { Module, Global } from '@nestjs/common';
import { NgrokService } from './ngrok.service';

@Global()
@Module({
  providers: [NgrokService],
  exports: [NgrokService],
})
export class NgrokModule {}

