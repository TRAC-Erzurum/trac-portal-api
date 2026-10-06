import { TargetRecordType } from '../constants/type-translation';

/** One record of the target's intake contract. */
export interface TargetRecord {
  externalId: string;
  externalIncidentId: string;
  type?: TargetRecordType;
  resolves?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  lat?: number;
  lng?: number;
  locationLabel?: string;
  /** Absolute URLs on the portal's public origin; the target downloads them. */
  photos?: string[];
  observedAt: string;
  reporter: { email: string; label: string; verified: boolean };
}
