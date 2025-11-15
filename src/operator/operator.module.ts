import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { services } from './services';
import { OperatorService } from './services/operator.service';
import { controllers } from './controllers';
import { CsvParserService } from './services/csv-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Operator])],
  controllers: [...controllers],
  providers: [
    ...services,
    {
      provide: Logger,
      useFactory: () => new Logger(CsvParserService.name),
    },
  ],
  exports: [OperatorService],
})
export class OperatorModule {}
