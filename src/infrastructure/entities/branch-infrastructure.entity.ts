import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { InfrastructureType } from '../enums/infrastructure-type.enum';

@Entity('branch_infrastructure')
export class BranchInfrastructure extends BaseEntity {
  @Column({ nullable: false })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ nullable: false, type: 'enum', enum: InfrastructureType })
  type: InfrastructureType;

  @Column({ nullable: true })
  repeaterMode: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ nullable: true, type: 'int' })
  altitude: number;

  @Column({ nullable: true })
  coverage: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 4 })
  rxFrequency: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 4 })
  txFrequency: number;

  @Column({ nullable: true })
  offset: string;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 1 })
  txCtcssTone: number;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 1 })
  rxCtcssTone: number;

  @Column({ nullable: true })
  txDcsCode: string;

  @Column({ nullable: true, length: 1 })
  txDcsPolarity: string;

  @Column({ nullable: true })
  rxDcsCode: string;

  @Column({ nullable: true, length: 1 })
  rxDcsPolarity: string;

  @Column({ nullable: true })
  echolinkNode: string;

  @Column({ nullable: true })
  echolinkName: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 4 })
  aprsFrequency: number;

  @Column({ nullable: true, default: false })
  aprsIsIgate: boolean;

  @Column({ nullable: true, default: false })
  aprsIsDigipeater: boolean;

  @Column({ nullable: true })
  aprsIgateMode: string;

  @Column({ nullable: true })
  aprsDigipeaterType: string;

  @Column({ nullable: true })
  aprsPath: string;

  @Column({ nullable: true })
  aprsServer: string;

  @Column({ nullable: true })
  digipeater: string;

  @Column({ nullable: true })
  hfFrequencyRange: string;

  @Column({ nullable: true })
  hfMode: string;
}
