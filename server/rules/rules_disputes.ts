import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';

/**
 * Placeholder for dispute-process rules; integrate with your own dispute DB.
 */
export function runDisputeRules(_report: CreditReport): IssueFlag[] {
  return [];
}
