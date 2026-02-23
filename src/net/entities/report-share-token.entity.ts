import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('report_share_tokens')
export class ReportShareToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  token: string;

  @Column({ type: 'uuid' })
  netId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
