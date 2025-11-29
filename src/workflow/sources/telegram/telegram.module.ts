/**
 * Telegram Module
 */

import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { WorkflowModule } from '../../workflow.module';

@Module({
  imports: [forwardRef(() => WorkflowModule)],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

