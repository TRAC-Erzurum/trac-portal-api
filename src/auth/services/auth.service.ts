import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload } from '../types/auth.types';
import { UserService } from 'src/user/services/user.service';
import { GoogleProfile } from '../types/auth.types';
import { RegisterDto } from '../dto/register.dto';
import { OperatorService } from '../../operator/services/operator.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly operatorService: OperatorService,
  ) {}

  async validateOAuthUser(profile: GoogleProfile): Promise<AuthUser> {
    const email = profile.emails[0].value;

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        callSign: existingUser.operator?.callSign,
        provider: existingUser.provider,
        providerId: existingUser.providerId,
        fullName: existingUser.fullName,
        picture: existingUser.picture,
      };
    }

    const createdUser = await this.userService.create({
      email,
      fullName: [profile.name.givenName, profile.name.familyName]
        .filter(Boolean)
        .join(' '),
      picture: profile.photos[0]?.value || null,
      providerId: profile.id,
      provider: 'google',
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      callSign: createdUser.operator?.callSign,
      provider: createdUser.provider,
      providerId: createdUser.providerId,
      fullName: createdUser.fullName,
      picture: createdUser.picture,
    };
  }

  async validateLocalUser(
    identifier: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.userService.validate(identifier, password);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      callSign: user.operator?.callSign,
      provider: user.provider,
    };
  }

  login(user: AuthUser): { access_token: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      role: user.role,
      callSign: user.callSign,
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Kullanıcı zaten mevcut');
    }

    const operator = await this.operatorService.create({
      callSign: dto.callSign,
      city: dto.city,
      country: dto.country,
      district: dto.district,
      fullName: dto.fullName,
    });

    await this.userService.create({
      email: dto.email,
      password: dto.password,
      salt: crypto.randomBytes(16).toString('hex'),
      fullName: dto.fullName,
      provider: 'local',
      operator: operator,
    });
  }
}
