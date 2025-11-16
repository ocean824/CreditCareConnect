import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { thresholds } from '../config/thresholds';
import { clusterTradelinesByCreditorAndAccount, createIssueFlag } from './utils';

/**
 * Balance/amount related rules.
 */
export function runBalanceRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...ruleCrossBureauBalanceMismatchModerate(report));
  issues.push(...ruleCrossBureauBalanceMismatchSevere(report));
  issues.push(...rulePastDueOnZeroBalance(report));
  issues.push(...ruleHighCreditLowerThanBalance(report));
  return issues;
}

function ruleCrossBureauBalanceMismatchModerate(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const clusters = clusterTradelinesByCreditorAndAccount(report);

  for (const cluster of clusters) {
    if (cluster.items.length < 2) continue;
    const balances = cluster.items
      .map(i => i.tradeline.balance)
      .filter((b): b is number => typeof b === 'number');
    if (balances.length < 2) continue;

    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const diff = max - min;
    const pct = min === 0 ? 1 : diff / min;

    const isSevere =
      diff >= thresholds.crossBureauBalanceToleranceSevereAbs ||
      pct >= thresholds.crossBureauBalanceToleranceSeverePct;
    const isModerate =
      diff >= thresholds.crossBureauBalanceToleranceAbs ||
      pct >= thresholds.crossBureauBalanceTolerancePct;

    if (isModerate && !isSevere) {
      issues.push(
        createIssueFlag({
          ruleId: 'XB_001_CROSS_BUREAU_BALANCE_MISMATCH_MODERATE',
          family: 'CROSS_BUREAU',
          category: 'CROSS_BUREAU_BALANCE_INCONSISTENT',
          severity: 'MEDIUM',
          statutes: ['FCRA_607b', 'FCRA_623'],
          affectedEntityType: 'CrossBureau',
          affectedBureaus: cluster.items.map(i => i.bureau),
          affectedIds: cluster.items.map(i => i.tradeline.internalId),
          descriptionMachine:
            'Moderate cross-bureau balance mismatch detected for clustered tradeline.',
          explanationKey: 'XB_BALANCE_MISMATCH_MODERATE',
          details: { balances, clusterKey: cluster.clusterKey },
        }),
      );
    }
  }
  return issues;
}

function ruleCrossBureauBalanceMismatchSevere(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const clusters = clusterTradelinesByCreditorAndAccount(report);

  for (const cluster of clusters) {
    if (cluster.items.length < 2) continue;
    const balances = cluster.items
      .map(i => i.tradeline.balance)
      .filter((b): b is number => typeof b === 'number');
    if (balances.length < 2) continue;

    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const diff = max - min;
    const pct = min === 0 ? 1 : diff / min;

    const isSevere =
      diff >= thresholds.crossBureauBalanceToleranceSevereAbs ||
      pct >= thresholds.crossBureauBalanceToleranceSeverePct;

    if (isSevere) {
      issues.push(
        createIssueFlag({
          ruleId: 'XB_002_CROSS_BUREAU_BALANCE_MISMATCH_SEVERE',
          family: 'CROSS_BUREAU',
          category: 'CROSS_BUREAU_BALANCE_INCONSISTENT',
          severity: 'HIGH',
          statutes: ['FCRA_607b', 'FCRA_623'],
          affectedEntityType: 'CrossBureau',
          affectedBureaus: cluster.items.map(i => i.bureau),
          affectedIds: cluster.items.map(i => i.tradeline.internalId),
          descriptionMachine:
            'Severe cross-bureau balance mismatch detected for clustered tradeline.',
          explanationKey: 'XB_BALANCE_MISMATCH_SEVERE',
          details: { balances, clusterKey: cluster.clusterKey },
        }),
      );
    }
  }
  return issues;
}

function rulePastDueOnZeroBalance(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if ((tl.balance ?? 0) === 0 && (tl.pastDueAmount ?? 0) > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'TL_INT_003_PAST_DUE_ON_ZERO_BALANCE',
            family: 'TRADLINE_INTERNAL',
            category: 'PASTDUE_ON_ZERO_BALANCE',
            severity: 'HIGH',
            statutes: ['FCRA_623', 'FCRA_607b', 'FDCPA_807'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline reports a past-due amount on a zero balance account.',
            explanationKey: 'TL_PASTDUE_ZERO_BALANCE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              balance: tl.balance,
              pastDueAmount: tl.pastDueAmount,
            },
          }),
        );
      }
    }
  }
  return issues;
}

function ruleHighCreditLowerThanBalance(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (
        typeof tl.balance === 'number' &&
        typeof tl.highCreditLimit === 'number' &&
        tl.balance > tl.highCreditLimit
      ) {
        issues.push(
          createIssueFlag({
            ruleId: 'TL_INT_004_HIGH_CREDIT_LOWER_THAN_BALANCE',
            family: 'TRADLINE_INTERNAL',
            category: 'BALANCE_EXCEEDS_HIGH_CREDIT',
            severity: 'MEDIUM',
            statutes: ['FCRA_607b'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline balance exceeds the reported high credit limit.',
            explanationKey: 'TL_BALANCE_GT_HIGH_CREDIT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              balance: tl.balance,
              highCreditLimit: tl.highCreditLimit,
            },
          }),
        );
      }
    }
  }
  return issues;
}
