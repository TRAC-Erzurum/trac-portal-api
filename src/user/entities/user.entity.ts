import { Entity, Column, OneToOne } from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
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
  providerId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  password: string | null;

  @Column({ nullable: true, type: 'varchar' })
  salt: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.GUEST })
  role: Role;

  @Column({ default: false })
  isTemporaryPassword: boolean;

  @OneToOne(() => Operator, (operator) => operator.user)
  operator: Operator;
}
