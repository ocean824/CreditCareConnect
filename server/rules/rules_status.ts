import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag } from './utils';

export function runStatusRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...ruleTransferredWithNonZeroBalance(report));
  issues.push(...ruleTransferredButPaymentHistoryContinues(report));
  issues.push(...ruleClosedOrPaidWithPastDue(report));
  issues.push(...ruleStatusConflictsWithPaymentHistory(report));
  return issues;
}

function ruleTransferredWithNonZeroBalance(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if ((tl.status === 'Transferred' || tl.status === 'Sold') && (tl.balance ?? 0) > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'ST_001_TRANSFERRED_WITH_NONZERO_BALANCE',
            family: 'STATUS',
            category: 'SOLD_ACCOUNT_NON_ZERO_BALANCE',
            severity: 'HIGH',
            statutes: ['FCRA_607b', 'FCRA_623', 'METRO2'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline is marked as transferred/sold but still reports a non-zero balance.',
            explanationKey: 'ST_TRANSFERRED_NONZERO_BAL',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              status: tl.status,
              balance: tl.balance,
            },
          }),
        );
      }
    }
  }
  return issues;
}

function ruleTransferredButPaymentHistoryContinues(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if ((tl.status === 'Transferred' || tl.status === 'Sold') && tl.paymentHistory?.length) {
        issues.push(
          createIssueFlag({
            ruleId: 'ST_002_TRANSFERRED_BUT_PAYMENT_HISTORY_CONTINUES',
            family: 'STATUS',
            category: 'LATE_AFTER_TRANSFER',
            severity: 'MEDIUM',
            statutes: ['FCRA_607b', 'METRO2'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline is marked as transferred/sold but still contains ongoing payment history.',
            explanationKey: 'ST_TRANSFERRED_HISTORY_CONTINUES',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              status: tl.status,
              paymentHistoryLength: tl.paymentHistory.length,
            },
          }),
        );
      }
    }
  }
  return issues;
}

function ruleClosedOrPaidWithPastDue(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const hasPastDue = (tl.pastDueAmount ?? 0) > 0;
      const isClosedOrPaid = tl.status === 'Closed' || tl.status === 'Paid';

      if (hasPastDue && isClosedOrPaid) {
        issues.push(
          createIssueFlag({
            ruleId: 'ST_004_PAID_OR_CLOSED_WITH_PAST_DUE',
            family: 'STATUS',
            category: 'PASTDUE_ON_CLOSED_OR_PAID_ACCOUNT',
            severity: 'HIGH',
            statutes: ['FCRA_623', 'FCRA_607b', 'FDCPA_807'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline is reported as closed/paid but still shows a past-due amount.',
            explanationKey: 'ST_CLOSED_PAID_BUT_PASTDUE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              status: tl.status,
              pastDueAmount: tl.pastDueAmount,
            },
          }),
        );
      }
    }
  }
  return issues;
}

function ruleStatusConflictsWithPaymentHistory(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (!tl.paymentHistory || tl.paymentHistory.length === 0) continue;
      const hasLate = tl.paymentHistory.some(p => p.status !== 'OK' && p.status !== 'Unknown');

      if (tl.status === 'Open' && hasLate) {
        issues.push(
          createIssueFlag({
            ruleId: 'ST_007_STATUS_CONFLICTS_WITH_PAYMENT_HISTORY',
            family: 'STATUS',
            category: 'STATUS_HISTORY_CONFLICT',
            severity: 'MEDIUM',
            statutes: ['FCRA_607b'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline status suggests current/good standing, but payment history shows delinquencies.',
            explanationKey: 'ST_STATUS_HISTORY_CONFLICT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              status: tl.status,
              paymentHistorySample: tl.paymentHistory.slice(0, 12),
            },
          }),
        );
      }
    }
  }
  return issues;
}
