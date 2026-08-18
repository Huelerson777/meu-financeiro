import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from '../../logs/logs.service';
import { sanitizeBody } from '../utils/sanitize-body';

// Tamanho máximo do stack trace guardado por erro — o bastante pra
// localizar o arquivo/linha sem deixar o registro gigante.
const MAX_STACK_LENGTH = 2000;

/**
 * Filtro global de exceções.
 * Padroniza o formato de erro de toda a API e, pra erros 5xx (bug real,
 * não recusa esperada de validação/negócio), também grava um registro na
 * tabela `logs` — assim dá pra consultar depois via GET /api/logs
 * (action começa com "error.", ex.: "error.500") em vez de depender só do
 * log efêmero do console/Render.
 */
@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly logsService: LogsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message ?? 'Erro interno do servidor';

    if (status >= 500) {
      const stack = (exception as Error)?.stack;
      this.logger.error(`${request.method} ${request.url}`, stack);

      this.logsService.record({
        userId: (request as any).user?.id ?? null,
        action: `error.${status}`,
        ipAddress: request.ip ?? null,
        metadata: {
          method: request.method,
          path: request.url,
          message,
          status,
          body: sanitizeBody(request.body),
          stack: stack?.slice(0, MAX_STACK_LENGTH),
        },
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
