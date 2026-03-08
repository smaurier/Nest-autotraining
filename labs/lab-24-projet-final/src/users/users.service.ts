import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO: Inject PrismaService via constructor

// TODO: async findByEmail(email: string)
//   return this.prisma.user.findUnique({ where: { email } })

// TODO: async findById(id: number)
//   return this.prisma.user.findUnique({ where: { id } })

// TODO: async create(data: { email: string; password: string; name: string; role?: string })
//   return this.prisma.user.create({ data })

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
