import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  // TODO: Inject HealthCheckService and MemoryHealthIndicator
  // Hint: constructor(
  //   private health: HealthCheckService,
  //   private memory: MemoryHealthIndicator,
  // ) {}

  // TODO: Implement GET /health
  // It should use HealthCheckService to check application health
  // Include at least a memory check (heap used < 150MB)
  //
  // Hint:
  //   @Get()
  //   @HealthCheck()
  //   check() {
  //     return this.health.check([
  //       () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
  //     ]);
  //   }
  //
  // For additional checks in production, you could add:
  //   - Database connectivity (HttpHealthIndicator, TypeOrmHealthIndicator)
  //   - Disk space (DiskHealthIndicator)
  //   - Custom indicators

  @Get()
  @HealthCheck()
  check() {
    throw new Error('TODO: Not implemented');
  }
}
