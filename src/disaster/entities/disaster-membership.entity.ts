import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { DisasterRole } from '../enums/disaster-role.enum';
import { DisasterMembershipStatus } from '../enums/membership-status.enum';
import { Disaster } from './disaster.entity';

@Entity('disaster_memberships')
@Unique(['disasterId', 'userId'])
export class DisasterMembership extends BaseEntity {
  @Column({ type: 'uuid' })
  disasterId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: DisasterRole,
    enumName: 'disaster_role_enum',
  })
  role: DisasterRole;

  @Column({
    type: 'enum',
    enum: DisasterMembershipStatus,
    enumName: 'disaster_membership_status_enum',
    default: DisasterMembershipStatus.APPROVED,
  })
  status: DisasterMembershipStatus;

  @Column({ type: 'uuid', nullable: true })
  processedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @ManyToOne(() => Disaster, (disaster) => disaster.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'disasterId' })
  disaster: Disaster;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
