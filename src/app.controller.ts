import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Get the root response' })
  @ApiOkResponse({
    description: 'Returns a simple health response from the application root.',
    type: String,
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
