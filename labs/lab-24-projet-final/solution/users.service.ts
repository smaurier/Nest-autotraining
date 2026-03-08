import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) {
    return this.prisma.user.create({ data });
  }
}
