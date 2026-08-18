import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogsService } from '../../logs/logs.service';
import { sanitizeBody } from '../utils/sanitize-body';

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Rotas de auth (login/registro/refresh/recuperação de senha) não têm
// usuário autenticado ainda no momento da chamada, ou não representam uma
// mudança em dado financeiro do usuário — não fazem sentido nesta auditoria.
const IGNORED_PREFIXES = ['/api/auth/'];

/**
 * Grava um evento de auditoria (tabela `logs`) para toda requisição
 * mutante (POST/PATCH/PUT/DELETE) que um usuário autenticado completar com
 * sucesso — sem precisar instrumentar cada Service manualmente.
 *
 * A "action" é derivada da URL (`<recurso>.<create|update|delete>`), então
 * é uma etiqueta grosseira — o endpoint exato (com todos os detalhes de
 * sub-rotas como `/cards/installments/:id/pay`) fica preservado em
 * `metadata.path` pra quem precisar do detalhe fino.
 *
 * Nunca bloqueia nem atrasa a resposta real: a gravação roda em segundo
 * plano (ver LogsService.record) e qualquer falha nela é só logada.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly logsService: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;

    if (!AUDITED_METHODS.has(method) || IGNORED_PREFIXES.some((prefix) => originalUrl?.startsWith(prefix))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        const userId: string | undefined = request.user?.id;
        if (!userId) return;

        const resource = resourceFromUrl(originalUrl);
        const verb = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';

        this.logsService.record({
          userId,
          action: `${resource}.${verb}`,
          ipAddress: request.ip ?? null,
          metadata: {
            method,
            path: originalUrl,
            params: request.params,
            // A ordem entre este interceptor (registrado via APP_INTERCEPTOR)
            // e o TransformInterceptor (registrado em main.ts) não é
            // garantida, então o corpo aqui pode vir cru ou já dentro do
            // envelope `{ data }` — cobre os dois formatos.
            resourceId: request.params?.id ?? responseBody?.data?.id ?? responseBody?.id,
            body: sanitizeBody(request.body),
          },
        });
      }),
    );
  }
}

function resourceFromUrl(originalUrl: string): string {
  const withoutQuery = originalUrl?.split('?')[0] ?? '';
  const segments = withoutQuery.split('/').filter(Boolean); // ['api', 'transactions', ':id', ...]
  return segments[1] ?? 'unknown';
}
