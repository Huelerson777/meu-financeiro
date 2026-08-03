import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrai o usuário autenticado (populado pelo JwtAuthGuard) da requisição.
 * Uso: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
