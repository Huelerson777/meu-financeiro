import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // bodyParser:false + useBodyParser manual abaixo — o body parser
  // automático do Nest usa o limite padrão do Express (100kb), pequeno
  // demais pra um print de tela em base64 (anexo de feedback). rawBody:true
  // continua necessário pra validar a assinatura HMAC que a Meta manda no
  // webhook do WhatsApp (precisa do corpo bruto, antes do parse de JSON).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false });
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '8mb' });

  // Atrás do proxy do Render, sem isso `req.ip` retorna o IP interno do
  // proxy em vez do IP real do cliente — usado no log de auditoria.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Segurança
  app.use(helmet());
  app.enableCors({
    origin: true, // O "true" libera o acesso tanto para o seu localhost quanto para os links da Vercel
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    // A autenticação é 100% via header Authorization (Bearer token), sem cookies —
    // credentials:true não é necessário e, combinado com origin:true, permitiria
    // qualquer site fazer requisições "credenciadas" à API. Ver auditoria de segurança.
    credentials: false,
  });

  // Validação global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // HttpExceptionFilter e AuditInterceptor são globais via APP_FILTER/
  // APP_INTERCEPTOR em app.module.ts (precisam de DI pra injetar o
  // LogsService) — aqui só os que não dependem de nada.
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // As rotas do módulo MCP (backend/src/mcp/) precisam ficar fora do prefixo
  // /api: `.well-known/*` é path fixo por spec (RFC 8414/9728) e o Claude
  // descobre o authorization server a partir da URL raiz que você cola em
  // "Add MCP server". `mcp/oauth/consent` fica de fora dessa lista de
  // propósito — é o único endpoint deste módulo chamado já autenticado pelo
  // login normal (via frontend), então mantém o prefixo/interceptors padrão.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
      { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
      { path: 'mcp/oauth/register', method: RequestMethod.POST },
      { path: 'mcp/oauth/authorize', method: RequestMethod.GET },
      { path: 'mcp/oauth/token', method: RequestMethod.POST },
      { path: 'mcp', method: RequestMethod.ALL },
    ],
  });

  // Swagger — só em dev/staging. Em produção ele expõe todo o mapa da API
  // (endpoints, DTOs, estrutura de dados) publicamente, sem autenticação.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PouPay API')
      .setDescription('API completa do sistema de gestão financeira PouPay')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 PouPay API rodando em http://localhost:${port}/api`);
  console.log(`📚 Documentação Swagger em http://localhost:${port}/docs`);
}

bootstrap();
