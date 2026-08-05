import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

@ApiTags('App')
@Controller()
export class AppController {
  @Get('health')
  @AllowAnonymous()
  @ApiOkResponse({ type: HealthResponseDto })
  health() {
    return { status: 'ok' };
  }
}
