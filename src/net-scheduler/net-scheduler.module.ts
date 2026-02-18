import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Net } from '../net/entities/net.entity';
import { NetScheduler } from './entities/net-scheduler.entity';
import { NetSchedulerCommunicationChannel } from './entities/net-scheduler-communication-channel.entity';
import { NetSchedulerService } from './services/net-scheduler.service';
import { NetSchedulerCronService } from './services/net-scheduler-cron.service';
import { NetSchedulerController } from './controllers/net-scheduler.controller';
import { NetModule } from '../net/net.module';
import { BranchModule } from '../branch/branch.module';
import { OperatorModule } from '../operator/operator.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Net,
      NetScheduler,
      NetSchedulerCommunicationChannel,
    ]),
    NetModule,
    BranchModule,
    OperatorModule,
    UserModule,
  ],
  controllers: [NetSchedulerController],
  providers: [NetSchedulerService, NetSchedulerCronService],
  exports: [NetSchedulerService],
})
export class NetSchedulerModule {}
