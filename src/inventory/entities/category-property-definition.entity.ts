import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { EquipmentCategory } from './equipment-category.entity';
import { PropertyType } from '../enums/property-type.enum';

@Entity('category_property_definitions')
export class CategoryPropertyDefinition extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  categoryId: string;

  @ManyToOne(() => EquipmentCategory, (cat) => cat.propertyDefinitions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: EquipmentCategory;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'enum', enum: PropertyType, nullable: false })
  type: PropertyType;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  enumValues: string[] | null;

  @Column({ type: 'int', nullable: true })
  numberArrayMaxLength: number | null;

  @Column({ type: 'decimal', nullable: true })
  minValue: number | null;

  @Column({ type: 'decimal', nullable: true })
  maxValue: number | null;
}
