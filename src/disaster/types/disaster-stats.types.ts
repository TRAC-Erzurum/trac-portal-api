import { Disaster } from '../entities/disaster.entity';

export interface DisasterSeverityCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface DisasterStats {
  observationCount: number;
  rootCount: number;
  conflictingCount: number;
  severityCounts: DisasterSeverityCounts;
  lastObservationAt: string | null;
}

export type DisasterWithStats = Disaster & { stats: DisasterStats };
