import type { StatuteRef, IssueSeverity, IssueFlag } from '../models/issues';
import catalog from './rules_catalog.json';

export interface RulesCatalogEntry {
  rule_id: string;
  family: string;
  name: string;
  category: string;
  description: string;
  statutes: StatuteRef[];
  defaultSeverity: IssueSeverity;
  inputs: string[];
  logicSummary: string;
  explanationKey: string;
  implemented: boolean;
}

export interface RulesCatalog {
  rules: RulesCatalogEntry[];
}

const rulesCatalog = catalog as RulesCatalog;

export function getRulesCatalog(): RulesCatalog {
  return rulesCatalog;
}

export function getRuleById(ruleId: string): RulesCatalogEntry | undefined {
  return rulesCatalog.rules.find(r => r.rule_id === ruleId);
}

export function getRulesByFamily(family: string): RulesCatalogEntry[] {
  return rulesCatalog.rules.filter(r => r.family === family);
}

export function getRuleForIssue(issue: IssueFlag): RulesCatalogEntry | undefined {
  return getRuleById(issue.ruleId);
}
