import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EquipmentCategory,
  CategoryPropertyDefinition,
  EquipmentStatus,
  Equipment,
  EquipmentPhoto,
  EquipmentPropertyValue,
  EquipmentRelation,
} from './entities';
import { UserBranchMembership } from '../branch/entities/user-branch-membership.entity';
import { controllers } from './controllers';
import {
  services,
  EquipmentService,
  EquipmentCategoryService,
  EquipmentStatusService,
} from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipmentCategory,
      CategoryPropertyDefinition,
      EquipmentStatus,
      Equipment,
      EquipmentPhoto,
      EquipmentPropertyValue,
      EquipmentRelation,
      UserBranchMembership,
    ]),
  ],
  controllers: [...controllers],
  providers: [...services],
  exports: [EquipmentService, EquipmentCategoryService, EquipmentStatusService],
})
export class InventoryModule {}
