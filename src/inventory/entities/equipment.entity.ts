import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { EquipmentCategory } from './equipment-category.entity';
import { EquipmentStatus } from './equipment-status.entity';
import { EquipmentPhoto } from './equipment-photo.entity';
import { EquipmentPropertyValue } from './equipment-property-value.entity';
import { EquipmentRelation } from './equipment-relation.entity';
import { OwnerType } from '../enums/owner-type.enum';
import { Operator } from '../../operator/entities/operator.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('equipment')
export class Equipment extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  categoryId: string;

  @ManyToOne(() => EquipmentCategory, (cat) => cat.equipment)
  @JoinColumn({ name: 'categoryId' })
  category: EquipmentCategory;

  @Column({ type: 'uuid', nullable: false })
  statusId: string;

  @ManyToOne(() => EquipmentStatus)
  @JoinColumn({ name: 'statusId' })
  status: EquipmentStatus;

  @Column({ type: 'enum', enum: OwnerType, nullable: false })
  ownerType: OwnerType;

  @Column({ type: 'uuid', nullable: true })
  operatorId: string | null;

  @ManyToOne(() => Operator, { nullable: true })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator | null;

  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string;

  @Column({ default: true })
  isVisible: boolean;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @OneToMany(() => EquipmentPhoto, (photo) => photo.equipment, {
    cascade: true,
  })
  photos: EquipmentPhoto[];

  @OneToMany(() => EquipmentPropertyValue, (pv) => pv.equipment, {
    cascade: true,
  })
  propertyValues: EquipmentPropertyValue[];

  @OneToMany(() => EquipmentRelation, (rel) => rel.sourceEquipment)
  relationsAsSource: EquipmentRelation[];

  @OneToMany(() => EquipmentRelation, (rel) => rel.targetEquipment)
  relationsAsTarget: EquipmentRelation[];
}
