import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, todayIso, yearsBetween } from './utils';

/**
 * Disputable Items Rules - catches ANY negative items that can be disputed.
 * These are more permissive rules designed to find disputable items in most credit reports.
 */
export function runDisputableRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  console.log('🔎 [DISPUTABLE] Running disputable items detection...');
  
  // Count data points
  const totalTradelines = report.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
  const totalCollections = report.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
  const totalPublicRecords = report.bureaus.reduce((sum, b) => sum + b.publicRecords.length, 0);
  
  console.log(`🔎 [DISPUTABLE] Data: ${totalTradelines} tradelines, ${totalCollections} collections, ${totalPublicRecords} public records`);
  
  issues.push(...ruleAnyCollectionAccount(report));
  issues.push(...ruleAnyChargeOff(report));
  issues.push(...ruleAnyLateStatus(report));
  issues.push(...ruleAnyNegativePublicRecord(report));
  issues.push(...ruleHighBalanceUtilization(report));
  issues.push(...ruleRecentInquiries(report));
  
  console.log(`🔎 [DISPUTABLE] Found ${issues.length} disputable items`);
  
  return issues;
}

/**
 * ANY collection account is disputable - consumer can request verification
 */
function ruleAnyCollectionAccount(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      // Flag all collections - they can all be disputed for verification
      issues.push(
        createIssueFlag({
          ruleId: 'DISP_001_COLLECTION_ACCOUNT',
          family: 'DISPUTABLE',
          category: 'COLLECTION_ACCOUNT',
          severity: 'HIGH',
          statutes: ['FCRA_609', 'FCRA_611', 'FDCPA_809'],
          affectedEntityType: 'Collection',
          affectedBureaus: [b.bureau],
          affectedIds: [col.internalId],
          descriptionMachine:
            `Collection account from ${col.collectorName || 'unknown collector'} reporting balance of $${col.balance || 0}. Request debt validation and verification of original documentation.`,
          explanationKey: 'DISP_COLLECTION',
          details: {
            bureau: b.bureau,
            internalId: col.internalId,
            collectorName: col.collectorName,
            originalCreditor: col.originalCreditorName,
            balance: col.balance,
            status: col.status,
            accountName: col.collectorName || 'Collection Account',
          },
        })
      );
    }
  }
  return issues;
}

/**
 * ANY charge-off is disputable
 */
function ruleAnyChargeOff(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (tl.status === 'ChargeOff') {
        issues.push(
          createIssueFlag({
            ruleId: 'DISP_002_CHARGE_OFF',
            family: 'DISPUTABLE',
            category: 'CHARGE_OFF_ACCOUNT',
            severity: 'HIGH',
            statutes: ['FCRA_611', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Charge-off on ${tl.creditorName} account with balance $${tl.balance || 0}. Request verification of charge-off date and proper status reporting.`,
            explanationKey: 'DISP_CHARGE_OFF',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              balance: tl.balance,
              status: tl.status,
              dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  return issues;
}

/**
 * ANY late payment status (30, 60, 90, 120+ days) is disputable
 */
function ruleAnyLateStatus(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  const lateStatuses = ['Late', 'Delinquent', 'Past Due'];
  const latePaymentCodes = ['30', '60', '90', '120', '150', 'CO'];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      // Check payment history for any late payments
      const latePayments = tl.paymentHistory?.filter(p => 
        latePaymentCodes.includes(p.status) || p.status === 'CO'
      ) || [];
      
      if (latePayments.length > 0) {
        const latestLate = latePayments[latePayments.length - 1];
        issues.push(
          createIssueFlag({
            ruleId: 'DISP_003_LATE_PAYMENT_HISTORY',
            family: 'DISPUTABLE',
            category: 'LATE_PAYMENT',
            severity: 'MEDIUM',
            statutes: ['FCRA_611', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Late payment history on ${tl.creditorName} account (${latePayments.length} late payments). Request verification of payment dates and reporting accuracy.`,
            explanationKey: 'DISP_LATE_PAYMENT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              latePaymentCount: latePayments.length,
              mostRecentLate: latestLate?.month,
              accountName: tl.creditorName,
            },
          })
        );
      }
      
      // Also check for negative statuses
      const negativeStatuses = ['Collection', 'Repossession', 'Foreclosure'];
      if (negativeStatuses.includes(tl.status)) {
        issues.push(
          createIssueFlag({
            ruleId: 'DISP_004_NEGATIVE_STATUS',
            family: 'DISPUTABLE',
            category: 'NEGATIVE_STATUS',
            severity: 'HIGH',
            statutes: ['FCRA_611', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} account showing ${tl.status} status. Request verification of status accuracy and supporting documentation.`,
            explanationKey: 'DISP_NEGATIVE_STATUS',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              status: tl.status,
              balance: tl.balance,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  return issues;
}

/**
 * ANY negative public record (bankruptcy, judgment, lien) is disputable
 */
function ruleAnyNegativePublicRecord(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const pr of b.publicRecords) {
      let description = '';
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'HIGH';
      
      if (pr.type === 'Bankruptcy') {
        const years = pr.filedDate ? yearsBetween(pr.filedDate, today) : 0;
        description = `Bankruptcy filed ${pr.filedDate || 'unknown date'}. Status: ${pr.status || 'unknown'}. Verify accuracy of filing date, case number, and discharge status.`;
        severity = 'CRITICAL';
      } else if (pr.type === 'TaxLien') {
        description = `Tax lien on record. Verify if lien has been released or satisfied and request removal if applicable.`;
      } else if (pr.type === 'Judgment') {
        description = `Civil judgment on record. Verify accuracy of judgment amount, date, and satisfaction status.`;
      } else {
        description = `Public record: ${pr.type}. Request verification of accuracy and completeness.`;
      }
      
      issues.push(
        createIssueFlag({
          ruleId: 'DISP_005_PUBLIC_RECORD',
          family: 'DISPUTABLE',
          category: 'PUBLIC_RECORD',
          severity,
          statutes: ['FCRA_605', 'FCRA_611'],
          affectedEntityType: 'PublicRecord',
          affectedBureaus: [b.bureau],
          affectedIds: [pr.internalId],
          descriptionMachine: description,
          explanationKey: 'DISP_PUBLIC_RECORD',
          details: {
            bureau: b.bureau,
            internalId: pr.internalId,
            type: pr.type,
            filedDate: pr.filedDate,
            status: pr.status,
            courtName: pr.courtName,
            accountName: `${pr.type} Record`,
          },
        })
      );
    }
  }
  return issues;
}

/**
 * High credit utilization (potential inaccuracy in reported limits)
 */
function ruleHighBalanceUtilization(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const balance = tl.balance ?? 0;
      const limit = tl.creditLimit ?? tl.highCreditLimit ?? 0;
      
      // Only check revolving accounts (credit cards)
      if (tl.type !== 'CreditCard' && tl.type !== 'LineOfCredit') continue;
      
      // Flag if balance > 90% of limit (very high utilization)
      if (limit > 0 && balance > limit * 0.9) {
        issues.push(
          createIssueFlag({
            ruleId: 'DISP_006_HIGH_UTILIZATION',
            family: 'DISPUTABLE',
            category: 'HIGH_UTILIZATION',
            severity: 'MEDIUM',
            statutes: ['FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} showing ${Math.round((balance/limit)*100)}% credit utilization. Verify credit limit is accurately reported.`,
            explanationKey: 'DISP_HIGH_UTIL',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              balance,
              creditLimit: limit,
              utilizationPct: Math.round((balance/limit)*100),
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  return issues;
}

/**
 * Recent hard inquiries (within 2 years) - can dispute unauthorized ones
 */
function ruleRecentInquiries(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const inq of b.inquiries) {
      if (inq.type !== 'Hard') continue;
      
      const years = yearsBetween(inq.date, today);
      if (years === undefined || years > 2) continue;
      
      issues.push(
        createIssueFlag({
          ruleId: 'DISP_007_HARD_INQUIRY',
          family: 'DISPUTABLE',
          category: 'UNAUTHORIZED_INQUIRY',
          severity: 'LOW',
          statutes: ['FCRA_604', 'FCRA_611'],
          affectedEntityType: 'Inquiry',
          affectedBureaus: [b.bureau],
          affectedIds: [inq.internalId],
          descriptionMachine:
            `Hard inquiry from ${inq.inquirerName} on ${inq.date}. If you did not authorize this inquiry, you can dispute it as unauthorized.`,
          explanationKey: 'DISP_INQUIRY',
          details: {
            bureau: b.bureau,
            internalId: inq.internalId,
            inquirerName: inq.inquirerName,
            date: inq.date,
            accountName: inq.inquirerName,
          },
        })
      );
    }
  }
  return issues;
}
