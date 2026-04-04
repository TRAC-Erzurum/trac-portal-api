import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchModule } from '../branch/branch.module';
import {
  EquipmentCategory,
  CategoryPropertyDefinition,
  EquipmentStatus,
  Equipment,
  EquipmentPhoto,
  EquipmentPropertyValue,
  EquipmentRelation,
} from './entities';
import { OperatorBranchMembership } from '../branch/entities/operator-branch-membership.entity';
import { controllers } from './controllers';
import {
  services,
  EquipmentService,
  EquipmentCategoryService,
  EquipmentStatusService,
} from './services';

@Module({
  imports: [
    BranchModule,
    TypeOrmModule.forFeature([
      EquipmentCategory,
      CategoryPropertyDefinition,
      EquipmentStatus,
      Equipment,
      EquipmentPhoto,
      EquipmentPropertyValue,
      EquipmentRelation,
      OperatorBranchMembership,
    ]),
  ],
  controllers: [...controllers],
  providers: [...services],
  exports: [EquipmentService, EquipmentCategoryService, EquipmentStatusService],
})
export class InventoryModule {}
