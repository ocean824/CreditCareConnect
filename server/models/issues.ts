import type { BureauName } from './creditReport';

export type StatuteRef =
  | 'FCRA_604'
  | 'FCRA_605'
  | 'FCRA_605a'
  | 'FCRA_605c'
  | 'FCRA_607b'
  | 'FCRA_609'
  | 'FCRA_611'
  | 'FCRA_623'
  | 'FCRA_623a3'
  | 'FDCPA_807'
  | 'FDCPA_809'
  | 'METRO2'
  | 'CARES_FORBEARANCE'
  | 'STATE_LAW_OTHER';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AffectedEntityType =
  | 'Tradeline'
  | 'Collection'
  | 'PublicRecord'
  | 'Inquiry'
  | 'Identity'
  | 'CrossBureau';

export interface IssueFlag {
  id: string;
  ruleId: string;
  family: string;
  category: string;
  severity: IssueSeverity;
  affectedEntityType: AffectedEntityType;
  affectedBureaus?: BureauName[];
  affectedIds: string[];
  statutes: StatuteRef[];
  descriptionMachine: string;
  explanationKey: string;
  details: Record<string, unknown>;
}

export interface DetectionRule {
  rule_id: string;
  family: string;
  name: string;
  description: string;
  statutes: StatuteRef[];
  defaultSeverity: IssueSeverity;
  inputs: string[];
  logicSummary: string;
}
