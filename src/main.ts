import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

function checkEnvVars() {
  const requiredVars = [
    'COOKIE_SECRET',
    'SESSION_SECRET',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
  ];
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      throw new Error(`Environment variable ${varName} is not set.`);
    }
  });
}

async function bootstrap() {
  checkEnvVars();
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const certTemplatesDir = path.join(process.cwd(), 'uploads', 'certificate-templates');
  if (!fs.existsSync(certTemplatesDir)) {
    fs.mkdirSync(certTemplatesDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const domain = configService.get<string>('DOMAIN');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.enableCors(
    isProduction
      ? {
          origin: `https://${domain}`,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
          credentials: true,
          exposedHeaders: ['Set-Cookie'],
        }
      : {
          origin: true,
          credentials: true,
        },
  );

  app.use(cookieParser(configService.get<string>('COOKIE_SECRET')));

  app.use(compression());

  app.use(
    session({
      secret: configService.get<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: configService.get<string>('NODE_ENV') === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transformOptions: { enableImplicitConversion: true },
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(configService.get<number>('PORT') || 8000);
}

bootstrap()
  .then(() => {
    console.log(
      `Server running on http://${process.env.DOMAIN ?? 'localhost'}:${process.env.PORT || 8000}`,
      `\nEnvironment: ${process.env.NODE_ENV || 'development'}`,
      `\nDatabase: postgres://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    );
  })
  .catch((err) => {
    console.error('Error starting server:', err);
    process.exit(1);
  });
