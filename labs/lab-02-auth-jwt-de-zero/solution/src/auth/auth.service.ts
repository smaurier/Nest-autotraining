// auth.service.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersRepository } from "../users/users.repository";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ id: string; email: string }> {
    if (this.usersRepository.findByEmail(email)) {
      throw new ConflictException(`${email} est déjà inscrit`);
    }
    const passwordHash = await this.passwordService.hash(password);
    const user = this.usersRepository.create({ email, passwordHash });
    return { id: user.id, email: user.email };
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = this.usersRepository.findByEmail(email);
    // Même message, que l'email soit inconnu OU le mot de passe faux : révéler lequel des
    // deux est faux, c'est révéler qu'un compte existe pour cet email (énumération de comptes).
    const MESSAGE = "Email ou mot de passe incorrect";
    if (!user) throw new UnauthorizedException(MESSAGE);

    const valide = await this.passwordService.compare(password, user.passwordHash);
    if (!valide) throw new UnauthorizedException(MESSAGE);

    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email });
    return { accessToken };
  }
}
