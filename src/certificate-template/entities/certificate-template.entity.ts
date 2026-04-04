import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('certificate_templates')
export class CertificateTemplate extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  branchId: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  imagePath: string;

  @Column({ type: 'jsonb', default: [] })
  elements: CertificateTemplateElement[];

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}

export interface CertificateTemplateElement {
  type: 'static' | 'placeholder';
  content?: string;
  placeholderKey?: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}
