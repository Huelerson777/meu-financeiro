import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Endpoint público e barato para monitores de uptime (UptimeRobot etc.) e
 * para manter o serviço do Render acordado. Não toca no banco de propósito:
 * o ping roda a cada poucos minutos e não deve gastar conexão do Neon nem
 * acordar o compute dele.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
