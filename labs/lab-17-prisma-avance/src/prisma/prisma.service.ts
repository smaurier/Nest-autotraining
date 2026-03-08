import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// TODO: Extend PrismaClient and implement OnModuleInit, OnModuleDestroy
// TODO: In the constructor, call super() then set up soft delete middleware
//
// Soft delete middleware using $use():
//   this.$use(async (params, next) => {
//     // For Product model "findMany" and "findFirst" actions,
//     // automatically add a where clause: deletedAt: null
//     // This filters out soft-deleted products
//
//     if (params.model === 'Product') {
//       if (params.action === 'findMany' || params.action === 'findFirst') {
//         if (!params.args) params.args = {};
//         if (!params.args.where) params.args.where = {};
//         if (params.args.where.deletedAt === undefined) {
//           params.args.where.deletedAt = null;
//         }
//       }
//     }
//     return next(params);
//   });
//
// TODO: onModuleInit() — await this.$connect()
// TODO: onModuleDestroy() — await this.$disconnect()

@Injectable()
export class PrismaService {
  // TODO: implement
}
