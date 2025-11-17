import { Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UserModule } from './user/user.module';
import databaseConfig from './shared/config/database.config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RolesGuard } from './auth/guards/roles.guard';
import { NetModule } from './net/net.module';
import { OperatorModule } from './operator/operator.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppController } from './app.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { QthModule } from './qth/qth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const config = configService.get<TypeOrmModuleOptions>('database');
        if (!config) {
          throw new Error('Database config is not defined');
        }
        return config;
      },
    }),
    AuthModule,
    UserModule,
    NetModule,
    OperatorModule,
    DashboardModule,
    QthModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        fallthrough: true,
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    Logger,
  ],
  controllers: [AppController],
})
export class AppModule implements OnApplicationShutdown {
  async onApplicationShutdown(signal: string) {
    console.log(`Application is shutting down...`, signal);
  }
}
