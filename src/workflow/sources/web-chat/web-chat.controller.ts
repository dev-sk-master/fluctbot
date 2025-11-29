import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WebChatService } from './web-chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Web Chat')
@Controller('web-chat/messages')
export class WebChatController {
  constructor(private readonly webChatService: WebChatService) {}

  @Post('send')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message via Web Chat',
    description:
      'Sends a message (text, audio, file, image, video) through the workflow system and returns the response',
  })
  @ApiQuery({
    name: 'workflowId',
    required: false,
    description: 'Workflow ID to execute (defaults to web-chat-echo-workflow)',
    example: 'web-chat-echo-workflow',
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Query('workflowId') workflowId?: string,
  ): Promise<MessageResponseDto> {
    return this.webChatService.processMessage(dto, workflowId);
  }
}
