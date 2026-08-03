import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('/api/auth/register (POST) deve rejeitar senha curta', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Teste', email: 'teste@teste.com', password: '123' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
