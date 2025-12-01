import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ConversationMessage])],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}

