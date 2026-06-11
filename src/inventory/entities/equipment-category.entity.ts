import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { CategoryPropertyDefinition } from './category-property-definition.entity';
import { Equipment } from './equipment.entity';

@Entity('equipment_categories')
export class EquipmentCategory extends BaseEntity {
  @Column({ nullable: false, unique: true })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => EquipmentCategory, (cat) => cat.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent: EquipmentCategory | null;

  @OneToMany(() => EquipmentCategory, (cat) => cat.parent)
  children: EquipmentCategory[];

  @Column({ nullable: true })
  photoPath: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => CategoryPropertyDefinition, (pd) => pd.category, {
    cascade: true,
  })
  propertyDefinitions: CategoryPropertyDefinition[];

  @OneToMany(() => Equipment, (eq) => eq.category)
  equipment: Equipment[];
}
