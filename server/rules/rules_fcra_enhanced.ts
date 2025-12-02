import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, todayIso, yearsBetween, daysBetween } from './utils';
import { thresholds } from '../config/thresholds';

export function runEnhancedFCRARules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...ruleDisputedDebtNotNoted(report));
  issues.push(...ruleResolvedDebtMisreported(report));
  issues.push(...ruleBankruptcyMisclassification(report));
  issues.push(...ruleDuplicateAccounts(report));
  issues.push(...ruleStaleReporting(report));
  return issues;
}

function ruleDisputedDebtNotNoted(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      if (col.status === 'Disputed' && col.metro2?.specialCommentCode !== 'XB') {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_001_DISPUTE_NOT_NOTED',
            family: 'FCRA_ENHANCED',
            category: 'DISPUTE_COMPLIANCE',
            severity: 'HIGH',
            statutes: ['FCRA_623a3'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              'Collection account is in dispute but the credit report does not properly note the dispute status per FCRA requirements.',
            explanationKey: 'FCRA_DISPUTE_NOT_NOTED',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              currentStatus: col.status,
              metro2Code: col.metro2?.specialCommentCode,
            },
          })
        );
      }
    }

    for (const tl of b.tradelines) {
      if (tl.metro2?.consumerInformationIndicator === 'D' && 
          tl.metro2?.specialCommentCode !== 'XB') {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_001_DISPUTE_NOT_NOTED',
            family: 'FCRA_ENHANCED',
            category: 'DISPUTE_COMPLIANCE',
            severity: 'HIGH',
            statutes: ['FCRA_623a3'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Tradeline is marked as disputed by consumer but the dispute is not properly reflected in the Metro 2 special comment code.',
            explanationKey: 'FCRA_DISPUTE_NOT_NOTED',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              consumerInfoIndicator: tl.metro2?.consumerInformationIndicator,
              specialCommentCode: tl.metro2?.specialCommentCode,
            },
          })
        );
      }
    }
  }
  return issues;
}

function ruleResolvedDebtMisreported(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const balance = tl.balance ?? 0;
      const isPaidOrClosed = tl.status === 'Paid' || tl.status === 'Closed';
      const isShowingDelinquent = tl.pastDueAmount && tl.pastDueAmount > 0;
      
      if (isPaidOrClosed && balance === 0 && isShowingDelinquent) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_002_RESOLVED_DEBT_DELINQUENT',
            family: 'FCRA_ENHANCED',
            category: 'ACCURACY',
            severity: 'HIGH',
            statutes: ['FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Account has been paid off or closed with zero balance, but is still reporting a past due amount, violating FCRA accuracy requirements.',
            explanationKey: 'FCRA_RESOLVED_STILL_DELINQUENT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              status: tl.status,
              balance: balance,
              pastDueAmount: tl.pastDueAmount,
            },
          })
        );
      }
    }

    for (const col of b.collections) {
      if (col.status === 'Paid' || col.status === 'Settled') {
        const balance = col.balance ?? 0;
        if (balance > 0) {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_002_RESOLVED_DEBT_BALANCE',
              family: 'FCRA_ENHANCED',
              category: 'ACCURACY',
              severity: 'HIGH',
              statutes: ['FCRA_623'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                'Collection account is marked as paid or settled, but is still showing a balance, which is inaccurate under FCRA.',
              explanationKey: 'FCRA_RESOLVED_STILL_BALANCE',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                collectorName: col.collectorName,
                status: col.status,
                balance: balance,
              },
            })
          );
        }
      }
    }
  }
  return issues;
}

function ruleBankruptcyMisclassification(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  const hasBankruptcy = report.bureaus.some(b => 
    b.publicRecords.some(pr => pr.type === 'Bankruptcy' && pr.status === 'Discharged')
  );
  
  if (!hasBankruptcy) return issues;

  for (const b of report.bureaus) {
    const bankruptcyRecord = b.publicRecords.find(
      pr => pr.type === 'Bankruptcy' && pr.status === 'Discharged'
    );
    
    if (!bankruptcyRecord) continue;

    for (const tl of b.tradelines) {
      if (tl.metro2?.specialCommentCode === 'AW' || 
          tl.metro2?.accountStatusCode === '97') {
        const isStillActive = tl.status !== 'Closed' && tl.status !== 'Paid';
        const hasBalance = (tl.balance ?? 0) > 0;
        
        if (isStillActive || hasBalance) {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_003_BANKRUPTCY_MISCLASS',
              family: 'FCRA_ENHANCED',
              category: 'BANKRUPTCY',
              severity: 'CRITICAL',
              statutes: ['FCRA_605c'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                'Debt discharged in bankruptcy is misreported as active or with a balance. Discharged debts must be reported with $0 balance and appropriate status.',
              explanationKey: 'FCRA_BANKRUPTCY_MISCLASSIFIED',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                creditorName: tl.creditorName,
                status: tl.status,
                balance: tl.balance,
                bankruptcyDate: bankruptcyRecord.filedDate,
                metro2AccountStatus: tl.metro2?.accountStatusCode,
                metro2SpecialComment: tl.metro2?.specialCommentCode,
              },
            })
          );
        }
      }
    }

    for (const col of b.collections) {
      if (col.metro2?.specialCommentCode === 'AW') {
        const hasBalance = (col.balance ?? 0) > 0;
        
        if (hasBalance || col.status === 'Open') {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_003_BANKRUPTCY_MISCLASS',
              family: 'FCRA_ENHANCED',
              category: 'BANKRUPTCY',
              severity: 'CRITICAL',
              statutes: ['FCRA_605c'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                'Collection included in bankruptcy discharge is still showing as open or with a balance, violating FCRA bankruptcy reporting requirements.',
              explanationKey: 'FCRA_BANKRUPTCY_MISCLASSIFIED',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                collectorName: col.collectorName,
                status: col.status,
                balance: col.balance,
                bankruptcyDate: bankruptcyRecord.filedDate,
              },
            })
          );
        }
      }
    }
  }
  return issues;
}

function ruleDuplicateAccounts(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    const accountMap = new Map<string, typeof b.tradelines>();
    
    for (const tl of b.tradelines) {
      const key = normalizeAccountKey(tl.creditorName, tl.accountNumberMasked);
      if (!accountMap.has(key)) {
        accountMap.set(key, []);
      }
      accountMap.get(key)!.push(tl);
    }
    
    for (const [key, tradelines] of Array.from(accountMap.entries())) {
      if (tradelines.length > 1) {
        const balances = tradelines.map((t) => t.balance ?? 0);
        const hasSameBalance = new Set(balances).size === 1 && balances[0] > 0;
        
        if (hasSameBalance) {
          for (const tl of tradelines.slice(1)) {
            issues.push(
              createIssueFlag({
                ruleId: 'FCRA_004_DUPLICATE_ACCOUNT',
                family: 'FCRA_ENHANCED',
                category: 'DUPLICATE',
                severity: 'HIGH',
                statutes: ['FCRA_623'],
                affectedEntityType: 'Tradeline',
                affectedBureaus: [b.bureau],
                affectedIds: [tl.internalId],
                descriptionMachine:
                  'Same debt appears to be reported multiple times with identical balance, which is inaccurate and inflates the total reported debt.',
                explanationKey: 'FCRA_DUPLICATE_ENTRY',
                details: {
                  bureau: b.bureau,
                  internalId: tl.internalId,
                  creditorName: tl.creditorName,
                  balance: tl.balance,
                  duplicateCount: tradelines.length,
                  clusterKey: key,
                },
              })
            );
          }
        }
      }
    }

    const collectionMap = new Map<string, typeof b.collections>();
    
    for (const col of b.collections) {
      const key = normalizeAccountKey(col.collectorName, col.originalCreditorName);
      if (!collectionMap.has(key)) {
        collectionMap.set(key, []);
      }
      collectionMap.get(key)!.push(col);
    }
    
    for (const [key, collections] of Array.from(collectionMap.entries())) {
      if (collections.length > 1) {
        const balances = collections.map((c) => c.balance ?? 0);
        const hasSameBalance = new Set(balances).size === 1 && balances[0] > 0;
        
        if (hasSameBalance) {
          for (const col of collections.slice(1)) {
            issues.push(
              createIssueFlag({
                ruleId: 'FCRA_004_DUPLICATE_COLLECTION',
                family: 'FCRA_ENHANCED',
                category: 'DUPLICATE',
                severity: 'HIGH',
                statutes: ['FCRA_623'],
                affectedEntityType: 'Collection',
                affectedBureaus: [b.bureau],
                affectedIds: [col.internalId],
                descriptionMachine:
                  'Same collection appears to be reported multiple times, potentially double-counting the debt and harming the consumer credit profile.',
                explanationKey: 'FCRA_DUPLICATE_ENTRY',
                details: {
                  bureau: b.bureau,
                  internalId: col.internalId,
                  collectorName: col.collectorName,
                  originalCreditor: col.originalCreditorName,
                  balance: col.balance,
                  duplicateCount: collections.length,
                },
              })
            );
          }
        }
      }
    }
  }
  return issues;
}

function ruleStaleReporting(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  const staleThresholdDays = 90;
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (!tl.lastUpdatedDate) continue;
      
      const daysSinceUpdate = daysBetween(tl.lastUpdatedDate, today);
      if (daysSinceUpdate === undefined) continue;
      
      const isDerogatory = ['ChargeOff', 'Collection', 'Repossession', 'Foreclosure'].includes(tl.status);
      
      if (isDerogatory && daysSinceUpdate > staleThresholdDays) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_005_STALE_DEROGATORY',
            family: 'FCRA_ENHANCED',
            category: 'STALE_DATA',
            severity: 'MEDIUM',
            statutes: ['FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Derogatory tradeline has not been updated in over 90 days. Furnishers must report accurate, current information.',
            explanationKey: 'FCRA_STALE_REPORTING',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              status: tl.status,
              lastUpdatedDate: tl.lastUpdatedDate,
              daysSinceUpdate: Math.round(daysSinceUpdate),
            },
          })
        );
      }
    }
  }
  return issues;
}

function normalizeAccountKey(name1?: string, name2?: string): string {
  const normalize = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(name1)}|${normalize(name2)}`;
}
