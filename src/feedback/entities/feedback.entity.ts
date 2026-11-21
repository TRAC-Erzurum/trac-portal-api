import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { FeedbackGithubStatus } from '../enums/feedback-github-status.enum';
import { FeedbackCategory } from '../feedback.types';

@Entity('feedbacks')
@Index('IDX_feedbacks_createdAt', ['createdAt'])
@Check(
  'CHK_feedbacks_githubStatus',
  `"githubStatus" IN ('pending', 'sent', 'failed', 'skipped')`,
)
export class Feedback extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_feedbacks_user',
  })
  user?: User | null;

  /** Snapshot of the call sign at submission time. */
  @Column({ type: 'varchar', nullable: true })
  callSign: string | null;

  @Column({ type: 'varchar' })
  category: FeedbackCategory;

  @Column({ type: 'varchar', length: 120 })
  summary: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  attachmentPaths: string[];

  @Column({ type: 'varchar', default: FeedbackGithubStatus.PENDING })
  githubStatus: FeedbackGithubStatus;

  @Column({ type: 'integer', default: 0 })
  githubAttempts: number;

  @Column({ type: 'integer', nullable: true })
  githubIssueNumber: number | null;

  @Column({ type: 'varchar', nullable: true })
  githubIssueUrl: string | null;

  /** HTTP status and message of the last failed attempt. Never a token or key. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  githubError: string | null;
}
