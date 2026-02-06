import {
  Column,
  Entity,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { BranchCallSign } from './branch-call-sign.entity';
import { BranchType } from '../enums/branch-type.enum';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column({ unique: true, nullable: false })
  name: string;

  @Column({ nullable: false, type: 'enum', enum: BranchType })
  type: BranchType;

  @Column({ default: false })
  isHeadquarters: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  city: string;

  @OneToMany(() => BranchCallSign, (callSign) => callSign.branch, {
    cascade: true,
  })
  callSigns: BranchCallSign[];
}
