import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

class HealthResponseDto {
  // Explicit `type` — required when generating OpenAPI via tsx (no emitDecoratorMetadata).
  @ApiProperty({ type: String, example: 'ok', description: 'Service health indicator' })
  status!: string;
}

@ApiTags('System')
@Controller()
export class AppController {
  @Get('health')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Health check',
    description: 'Anonymous liveness probe. Returns `{ status: "ok" }` when the Nest process is up.',
  })
  @ApiOkResponse({ type: HealthResponseDto, description: 'API process is healthy' })
  health() {
    return { status: 'ok' };
  }
}
