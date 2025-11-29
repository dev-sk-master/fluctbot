import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get application information' })
  @ApiResponse({
    status: 200,
    description: 'Application information',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getHello() {
    return this.appService.getHello();
  }
}
