import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MANAGE_NET_KEY } from '../decorators/manage-net.decorator';
import { ICurrentUser } from '../../user/types/user.types';
import { UserService } from '../../user/services/user.service';
import { NetService } from '../services/net.service';

@Injectable()
export class ManageNetGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private netService: NetService,
    private userService: UserService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.get<string>(
      MANAGE_NET_KEY,
      context.getHandler(),
    );

    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const netId: string = request.params[paramName];
    const user: ICurrentUser = request.user;

    if (!netId || !user) {
      throw new ForbiddenException('Yetkilendirme başarısız');
    }

    const net = await this.netService.findOne(netId);

    if (!net) {
      throw new NotFoundException('Çevrim bulunamadı');
    }

    if (await this.userService.isAdmin(user.id)) {
      return true;
    }

    if (net.operator.user.id !== user.id) {
      throw new ForbiddenException('Bu işlemi yapmaya yetkiniz yok');
    }

    return true;
  }
}
