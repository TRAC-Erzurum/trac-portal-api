import { Module } from '@nestjs/common';
import { QthController } from './controllers/qth.controller';
import { QthService } from './services/qth.service';

@Module({
  controllers: [QthController],
  providers: [QthService],
  exports: [QthService],
})
export class QthModule {}
