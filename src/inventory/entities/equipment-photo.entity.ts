import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity('equipment_photos')
export class EquipmentPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  equipmentId: string;

  @ManyToOne(() => Equipment, (eq) => eq.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipmentId' })
  equipment: Equipment;

  @Column({ nullable: false })
  filePath: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
