import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { controllers } from './controllers';
import { entities } from './entities';
import { OIDC_CLOCK, OidcClock } from './oidc.constants';
import { services } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature(entities),
    UserModule,
    // Own instance with no shared secret: ID tokens are RS256-signed with the
    // key passed per call, never with JWT_SECRET.
    JwtModule.register({}),
  ],
  controllers: [...controllers],
  providers: [
    ...services,
    { provide: OIDC_CLOCK, useValue: (() => new Date()) as OidcClock },
  ],
})
export class OidcModule {}
