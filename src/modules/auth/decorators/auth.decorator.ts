import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from './roles.decorator';

export const Auth = (roles?: Role[]) => {
  if (!roles?.length) return applyDecorators(UseGuards(AuthGuard));
  return applyDecorators(Roles(...roles), UseGuards(AuthGuard, RolesGuard));
};

export const Admin = () => applyDecorators(UseGuards(AdminGuard));

export function getAuthToken(req: Request) {
  const auth = req.headers.authorization;
  const bearer = auth && /^Bearer (.+)$/.exec(auth);
  if (bearer) return bearer[1];

  const header = req.get['X-Auth-Token'];
  if (header) return header;

  return null;
}

export const AuthUser = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    if (request.user) return request.user;

    const jwtService = new JwtService();
    const token = getAuthToken(request);
    try {
      const payload = await jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  },
);
