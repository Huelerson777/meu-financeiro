import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // rawBody:true expõe req.rawBody — necessário pra validar a assinatura
  // HMAC que a Meta manda no webhook do WhatsApp (precisa do corpo bruto,
  // antes do parse de JSON).
  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  app.setGlobalPrefix('api');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('FinanceFlow API')
    .setDescription('API completa do sistema de gestão financeira FinanceFlow')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 FinanceFlow API rodando em http://localhost:${port}/api`);
  console.log(`📚 Documentação Swagger em http://localhost:${port}/docs`);
}

bootstrap();
