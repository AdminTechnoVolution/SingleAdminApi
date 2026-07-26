import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import helmetModule = require('helmet');
import { AppModule } from './app.module';

const helmet = helmetModule as unknown as typeof import('helmet').default;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>('ADMIN_PORTAL_ORIGIN'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Single Admin API')
    .setDescription('API de solo lectura para el portal administrativo de Single')
    .setVersion('1.0')
    .addCookieAuth('single_admin_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.get<number>('PORT', 3100));
}
void bootstrap();
