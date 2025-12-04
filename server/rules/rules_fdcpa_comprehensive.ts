import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, todayIso, yearsBetween, daysBetween } from './utils';

export function runComprehensiveFDCPARules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  console.log('🔍 [FDCPA] Running comprehensive FDCPA violation detection...');
  
  issues.push(...ruleFDCPA807FalseRepresentations(report));
  issues.push(...ruleFDCPA808UnfairPractices(report));
  issues.push(...ruleFDCPA809DebtValidation(report));
  issues.push(...ruleCollectionWithoutProperDocumentation(report));
  
  console.log(`🔍 [FDCPA] Found ${issues.length} FDCPA violations`);
  return issues;
}

function ruleFDCPA807FalseRepresentations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      const balance = col.balance ?? 0;
      
      if (balance < 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_807_NEGATIVE_BALANCE',
            family: 'FDCPA',
            category: 'FALSE_REPRESENTATION',
            severity: 'HIGH',
            statutes: ['FDCPA_807', 'FCRA_623'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} shows impossible negative balance of $${balance}. Under FDCPA §807, debt collectors cannot make false or misleading representations about the amount of debt owed.`,
            explanationKey: 'FDCPA_FALSE_AMOUNT',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              balance,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      if (!col.originalCreditorName && balance > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_807_UNKNOWN_CREDITOR',
            family: 'FDCPA',
            category: 'FALSE_REPRESENTATION',
            severity: 'HIGH',
            statutes: ['FDCPA_807', 'FDCPA_809'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} does not identify the original creditor. Under FDCPA §807(2) and §809, collectors must accurately identify the original creditor and the nature of the debt.`,
            explanationKey: 'FDCPA_UNIDENTIFIED_CREDITOR',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              balance,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      if (col.status === 'Open' && balance === 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_807_ZERO_BALANCE_OPEN',
            family: 'FDCPA',
            category: 'FALSE_REPRESENTATION',
            severity: 'HIGH',
            statutes: ['FDCPA_807', 'FCRA_623'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} shows $0 balance but is still reported as open/active. Under FDCPA §807, continuing to report a paid or zero-balance debt as active is a false representation.`,
            explanationKey: 'FDCPA_ZERO_BALANCE_ACTIVE',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              status: col.status,
              balance,
              accountName: col.collectorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleFDCPA808UnfairPractices(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      if (!col.dateOfFirstDelinquency) continue;
      
      const years = yearsBetween(col.dateOfFirstDelinquency, today);
      if (years === undefined) continue;
      
      if (years > 4) {
        const balance = col.balance ?? 0;
        if (balance > 0) {
          issues.push(
            createIssueFlag({
              ruleId: 'FDCPA_808_TIME_BARRED_DEBT',
              family: 'FDCPA',
              category: 'UNFAIR_PRACTICE',
              severity: 'HIGH',
              statutes: ['FDCPA_808', 'FDCPA_807'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                `Collection from ${col.collectorName} is ${Math.round(years)} years old, potentially time-barred under state statute of limitations. Under FDCPA §808, collecting on time-barred debt without disclosure may constitute an unfair practice.`,
              explanationKey: 'FDCPA_TIME_BARRED',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                collectorName: col.collectorName,
                dateOfFirstDelinquency: col.dateOfFirstDelinquency,
                yearsSinceDOFD: Math.round(years),
                balance,
                accountName: col.collectorName,
              },
            })
          );
        }
      }
    }
    
    const collectionsByCreditor = new Map<string, typeof b.collections>();
    
    for (const col of b.collections) {
      const key = (col.originalCreditorName || col.collectorName || '').toLowerCase().trim();
      if (!collectionsByCreditor.has(key)) {
        collectionsByCreditor.set(key, []);
      }
      collectionsByCreditor.get(key)!.push(col);
    }
    
    for (const [creditor, cols] of Array.from(collectionsByCreditor.entries())) {
      if (cols.length > 1) {
        const totalBalance = cols.reduce((sum, c) => sum + (c.balance ?? 0), 0);
        
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_808_MULTIPLE_COLLECTORS_SAME_DEBT',
            family: 'FDCPA',
            category: 'UNFAIR_PRACTICE',
            severity: 'HIGH',
            statutes: ['FDCPA_808', 'FCRA_623'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: cols.map(c => c.internalId),
            descriptionMachine:
              `${cols.length} collection accounts appear to be reporting the same underlying debt from ${creditor}, totaling $${totalBalance}. Under FDCPA §808, double-reporting the same debt inflates the amount owed and is an unfair practice.`,
            explanationKey: 'FDCPA_DUPLICATE_REPORTING',
            details: {
              bureau: b.bureau,
              originalCreditor: creditor,
              collectionCount: cols.length,
              totalBalance,
              collectors: cols.map(c => c.collectorName),
              accountName: cols[0].collectorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleFDCPA809DebtValidation(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      if (!col.openedDate) continue;
      
      const daysSinceOpened = daysBetween(col.openedDate, today);
      if (daysSinceOpened === undefined) continue;
      
      if (daysSinceOpened <= 30) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_809_VALIDATION_PERIOD',
            family: 'FDCPA',
            category: 'VALIDATION_NOTICE',
            severity: 'MEDIUM',
            statutes: ['FDCPA_809'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} was recently placed (${daysSinceOpened} days ago). Under FDCPA §809, you have 30 days from initial contact to dispute the debt and request validation. The collector must provide written verification.`,
            explanationKey: 'FDCPA_VALIDATION_PERIOD',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              openedDate: col.openedDate,
              daysSinceOpened,
              daysRemaining: Math.max(0, 30 - daysSinceOpened),
              accountName: col.collectorName,
            },
          })
        );
      }
      
      if (!col.originalCreditorName && !col.accountNumberMasked) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_809_INSUFFICIENT_INFO',
            family: 'FDCPA',
            category: 'VALIDATION_FAILURE',
            severity: 'HIGH',
            statutes: ['FDCPA_809', 'FCRA_611'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} lacks both original creditor name and account number. Under FDCPA §809(b), consumers can request and must receive the name of the original creditor and sufficient documentation to verify the debt.`,
            explanationKey: 'FDCPA_MISSING_VALIDATION_INFO',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              accountName: col.collectorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleCollectionWithoutProperDocumentation(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      const hasOriginalCreditor = !!col.originalCreditorName;
      const hasAccountNumber = !!col.accountNumberMasked;
      const hasDOFD = !!col.dateOfFirstDelinquency;
      const hasOpenDate = !!col.openedDate;
      
      const missingFields: string[] = [];
      if (!hasOriginalCreditor) missingFields.push('Original Creditor');
      if (!hasAccountNumber) missingFields.push('Account Number');
      if (!hasDOFD) missingFields.push('Date of First Delinquency');
      if (!hasOpenDate) missingFields.push('Collection Date');
      
      if (missingFields.length >= 2) {
        issues.push(
          createIssueFlag({
            ruleId: 'FDCPA_INCOMPLETE_COLLECTION',
            family: 'FDCPA',
            category: 'INCOMPLETE_DOCUMENTATION',
            severity: 'HIGH',
            statutes: ['FDCPA_809', 'FCRA_623', 'FCRA_611'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is missing ${missingFields.length} required fields: ${missingFields.join(', ')}. Under FDCPA §809 and FCRA §611, incomplete collection accounts cannot be verified and should be deleted.`,
            explanationKey: 'FDCPA_INCOMPLETE_DOCUMENTATION',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              missingFields,
              missingCount: missingFields.length,
              accountName: col.collectorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}
