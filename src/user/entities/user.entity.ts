import { Entity, Column, OneToOne, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role, GlobalRole } from '../../auth/enums/role.enum';
import { Operator } from '../../operator/entities/operator.entity';
import { BaseEntity } from '../../shared/entities/base.entity';
import { UserBranchMembership } from '../../branch/entities/user-branch-membership.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column()
  email: string;

  @Column({ nullable: true, type: 'varchar' })
  fullName: string | null;

  @Column({ nullable: true, type: 'varchar' })
  picture: string | null;

  @Column()
  provider: string;

  @Column({ nullable: true, type: 'varchar' })
  @Exclude()
  providerId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  @Exclude()
  password: string | null;

  @Column({ nullable: true, type: 'varchar' })
  @Exclude()
  salt: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.GUEST })
  role: Role;

  @Column({
    type: 'enum',
    enum: GlobalRole,
    enumName: 'global_role_enum',
    default: GlobalRole.GUEST,
  })
  globalRole: GlobalRole;

  @Column({ default: false })
  @Exclude()
  isTemporaryPassword: boolean;

  @Column({ nullable: true, type: 'uuid' })
  currentBranchId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  addresses: { type: string; address: string; qth: string }[] | null;

  @Column({ type: 'jsonb', nullable: true })
  phoneNumbers: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  emergencyContacts: { name: string; callSign?: string; phone: string }[] | null;

  @Column({ type: 'jsonb', nullable: true })
  expertiseAreas: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  trainings: { title: string; institution?: string; year?: number }[] | null;

  @Column({ nullable: true, type: 'varchar' })
  profession: string | null;

  @Column({ nullable: true, type: 'date' })
  birthDate: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  idNumber: string | null;

  @Column({ type: 'timestamp', nullable: true })
  privacyAcceptedAt: Date | null;

  @OneToOne(() => Operator, (operator) => operator.user)
  operator: Operator;

  @OneToMany(() => UserBranchMembership, (m) => m.user)
  branchMemberships: UserBranchMembership[];
}
