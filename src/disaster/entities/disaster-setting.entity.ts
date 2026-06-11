import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';

export interface DisasterScoringWeights {
  create: Record<string, number>;
  support: Record<string, number>;
  contradict: Record<string, number>;
}

export interface DisasterSettingConfig {
  scoringWeights: DisasterScoringWeights;
  duplicateRadiusMeters: number;
  conflict: {
    minContradicts: number;
    ratioThreshold: number;
  };
  ranking: {
    confidenceWeight: number;
    severityWeight: number;
    recencyHalfLifeHours: number;
  };
}

@Entity('disaster_settings')
export class DisasterSetting extends BaseEntity {
  @Column({ type: 'jsonb' })
  config: DisasterSettingConfig;
}
