import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// TODO: Make this module @Global() so PrismaService is available everywhere
// TODO: Add PrismaService to the providers array
// TODO: Add PrismaService to the exports array

@Module({
  providers: [],
  exports: [],
})
export class PrismaModule {}
