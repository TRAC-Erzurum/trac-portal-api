import { Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { QthModule } from './qth/qth.module';
import { BranchModule } from './branch/branch.module';
import { CommunicationChannelModule } from './communication-channel/communication-channel.module';
import { NetSchedulerModule } from './net-scheduler/net-scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
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
    ActivityModule,
    QthModule,
    BranchModule,
    CommunicationChannelModule,
    NetSchedulerModule,
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
