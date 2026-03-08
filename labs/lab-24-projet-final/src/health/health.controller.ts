import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

// TODO: Implement the health check controller
//   @ApiTags('health')
//   @Controller('health')
//
//   Inject HealthCheckService and PrismaService
//
//   @Get()
//   @HealthCheck()
//   check() {
//     return this.health.check([
//       () => this.prismaHealth.pingCheck('database', this.prisma),
//     ]);
//   }
//
//   Note: If PrismaHealthIndicator is not available in your version,
//   you can create a simple health check:
//   @Get()
//   async check() {
//     try {
//       await this.prisma.$queryRaw`SELECT 1`;
//       return { status: 'ok', database: 'up' };
//     } catch (error) {
//       return { status: 'error', database: 'down' };
//     }
//   }

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    // TODO: implement health check
    return { status: 'ok' };
  }
}
