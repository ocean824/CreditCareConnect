import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag } from './utils';

export function runCollectionRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...ruleMultipleOpenCollectionsSameDebt(report));
  issues.push(...ruleZeroBalanceCollectionOpenStatus(report));
  return issues;
}

function ruleMultipleOpenCollectionsSameDebt(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];

  interface KeyedCollection {
    key: string;
    bureau: string;
    balance?: number;
    internalId: string;
  }

  const buckets = new Map<string, KeyedCollection[]>();

  for (const b of report.bureaus) {
    for (const col of b.collections) {
      const key = [
        (col.collectorName || '').trim().toLowerCase(),
        (col.originalCreditorName || '').trim().toLowerCase(),
      ].join('|');

      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({
        key,
        bureau: b.bureau,
        balance: col.balance,
        internalId: col.internalId,
      });
    }
  }

  for (const [key, list] of buckets.entries()) {
    const openCollections = list;
    if (openCollections.length > 1) {
      issues.push(
        createIssueFlag({
          ruleId: 'COL_001_MULTIPLE_OPEN_COLLECTIONS_SAME_DEBT',
          family: 'COLLECTIONS',
          category: 'MULTIPLE_ACTIVE_COLLECTIONS',
          severity: 'HIGH',
          statutes: ['FCRA_607b', 'FDCPA_807'],
          affectedEntityType: 'Collection',
          affectedBureaus: openCollections.map(c => c.bureau as any),
          affectedIds: openCollections.map(c => c.internalId),
          descriptionMachine:
            'Multiple collection accounts appear to represent the same underlying debt.',
          explanationKey: 'COL_MULTIPLE_COLLECTIONS_SAME_DEBT',
          details: {
            key,
            internalIds: openCollections.map(c => c.internalId),
            balances: openCollections.map(c => c.balance),
          },
        }),
      );
    }
  }
  return issues;
}

function ruleZeroBalanceCollectionOpenStatus(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      const balance = col.balance ?? 0;
      const status = col.status ?? 'Open';
      if (balance === 0 && status === 'Open') {
        issues.push(
          createIssueFlag({
            ruleId: 'COL_005_ZERO_BALANCE_COLLECTION_OPEN_STATUS',
            family: 'COLLECTIONS',
            category: 'ZERO_BALANCE_COLLECTION_OPEN_STATUS',
            severity: 'MEDIUM',
            statutes: ['FCRA_623', 'FDCPA_807'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              'Collection account shows zero balance but is still reported as open.',
            explanationKey: 'COL_ZERO_BAL_OPEN',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              balance,
              status,
            },
          }),
        );
      }
    }
  }
  return issues;
}
