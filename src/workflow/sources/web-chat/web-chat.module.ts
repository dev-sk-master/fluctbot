import { Module } from '@nestjs/common';
import { WebChatController } from './web-chat.controller';
import { WebChatService } from './web-chat.service';
import { WorkflowModule } from '../../workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [WebChatController],
  providers: [WebChatService],
  exports: [WebChatService],
})
export class WebChatModule {}
