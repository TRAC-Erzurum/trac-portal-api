import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ICurrentUser } from '../types/user.types';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ICurrentUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as ICurrentUser;
  },
);
