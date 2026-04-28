import { Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UserModule } from './user/user.module';
import databaseConfig from './shared/config/database.config';
import r2Config from './shared/config/r2.config';
import { StorageModule } from './shared/storage';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RolesGuard } from './auth/guards/roles.guard';
import { NetModule } from './net/net.module';
import { OperatorModule } from './operator/operator.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InsightsModule } from './insights/insights.module';
import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { QthModule } from './qth/qth.module';
import { BranchModule } from './branch/branch.module';
import { CommunicationChannelModule } from './communication-channel/communication-channel.module';
import { NetSchedulerModule } from './net-scheduler/net-scheduler.module';
import { CertificateTemplateModule } from './certificate-template/certificate-template.module';
import { InventoryModule } from './inventory/inventory.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Resolve api/.env even when process.cwd() is repo root or another workspace folder
      envFilePath: [resolve(__dirname, '../.env'), '.env'],
      load: [databaseConfig, r2Config],
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 100,
        },
      ],
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
    InsightsModule,
    ActivityModule,
    QthModule,
    BranchModule,
    CommunicationChannelModule,
    NetSchedulerModule,
    CertificateTemplateModule,
    InventoryModule,
    StorageModule,
    FeedbackModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
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
