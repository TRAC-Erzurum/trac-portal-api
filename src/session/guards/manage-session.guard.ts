import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionService } from '../services/session.service';
import { MANAGE_SESSION_KEY } from '../decorators/manage-session.decorator';
import { ICurrentUser } from '../../user/types/user.types';
import { UserService } from 'src/user/services/user.service';

@Injectable()
export class ManageSessionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private sessionService: SessionService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.get<string>(
      MANAGE_SESSION_KEY,
      context.getHandler(),
    );

    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const sessionId: string = request.params[paramName];
    const user: ICurrentUser = request.user;

    if (!sessionId || !user) {
      throw new ForbiddenException('Yetkilendirme başarısız');
    }

    const session = await this.sessionService.findOne(sessionId);

    if (!session) {
      throw new NotFoundException('Çevrim bulunamadı');
    }

    if (await this.userService.isAdmin(user.id)) {
      return true;
    }

    if (session.operator.user.id !== user.id) {
      throw new ForbiddenException('Bu işlemi yapmaya yetkiniz yok');
    }

    return true;
  }
}
