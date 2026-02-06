import { Entity, Column, OneToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role, GlobalRole } from '../../auth/enums/role.enum';
import { Operator } from '../../operator/entities/operator.entity';
import { BaseEntity } from '../../shared/entities/base.entity';

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

  @OneToOne(() => Operator, (operator) => operator.user)
  operator: Operator;
}
