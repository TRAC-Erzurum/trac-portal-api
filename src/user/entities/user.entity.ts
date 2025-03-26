import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { Operator } from '../../operator/entities/operator.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'enum', enum: Role, default: Role.GUEST })
  role: Role;

  @OneToOne(() => Operator, (operator) => operator.user)
  operator: Operator;
}
