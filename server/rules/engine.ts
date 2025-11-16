import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';

import { runBalanceRules } from './rules_balances';
import { runStatusRules } from './rules_status';
import { runTimelineRules } from './rules_timeline';
import { runCollectionRules } from './rules_collections';
import { runIdentityRules } from './rules_identity';
import { runDisputeRules } from './rules_disputes';

export function runAllRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...runBalanceRules(report));
  issues.push(...runStatusRules(report));
  issues.push(...runTimelineRules(report));
  issues.push(...runCollectionRules(report));
  issues.push(...runIdentityRules(report));
  issues.push(...runDisputeRules(report));
  return issues;
}
