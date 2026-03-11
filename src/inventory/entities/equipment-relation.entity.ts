import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Equipment } from './equipment.entity';
import { RelationType } from '../enums/relation-type.enum';

@Entity('equipment_relations')
@Unique(['sourceEquipmentId', 'targetEquipmentId'])
export class EquipmentRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  sourceEquipmentId: string;

  @ManyToOne(() => Equipment, (eq) => eq.relationsAsSource, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sourceEquipmentId' })
  sourceEquipment: Equipment;

  @Column({ type: 'uuid', nullable: false })
  targetEquipmentId: string;

  @ManyToOne(() => Equipment, (eq) => eq.relationsAsTarget, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'targetEquipmentId' })
  targetEquipment: Equipment;

  @Column({ type: 'enum', enum: RelationType, nullable: false })
  type: RelationType;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
