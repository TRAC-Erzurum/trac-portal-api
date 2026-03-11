import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';
import { CategoryPropertyDefinition } from './category-property-definition.entity';

@Entity('equipment_property_values')
export class EquipmentPropertyValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  equipmentId: string;

  @ManyToOne(() => Equipment, (eq) => eq.propertyValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'equipmentId' })
  equipment: Equipment;

  @Column({ type: 'uuid', nullable: false })
  propertyDefinitionId: string;

  @ManyToOne(() => CategoryPropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyDefinitionId' })
  propertyDefinition: CategoryPropertyDefinition;

  @Column({ type: 'jsonb', nullable: false })
  value: any;
}
