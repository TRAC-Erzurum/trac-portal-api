import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { UserService } from '../../user/services/user.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        if (!req?.cookies) return null;
        return req.cookies['auth_token'];
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const userExists = await this.userService.exists(payload.sub);

    if (!userExists) {
      throw new UnauthorizedException('User not found');
    }
    const user = await this.userService.findOne(payload.sub);
    const role = await this.userService.getEffectiveRole(payload.sub);

    return {
      id: payload.sub,
      email: payload.email,
      role,
      globalRole: user.globalRole,
      callSign: user.operator?.callSign,
      operatorId: user.operator?.id,
      picture: user.picture,
      provider: user.provider,
      fullName: user.fullName,
      isTemporaryPassword: user.isTemporaryPassword,
      currentBranchId: user.currentBranchId,
    };
  }
}
