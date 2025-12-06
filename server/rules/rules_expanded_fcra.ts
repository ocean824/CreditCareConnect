import type { CreditReport } from '../models/creditReport';
import type { IssueFlag, StatuteRef } from '../models/issues';
import { createIssueFlag } from './utils';

export function runExpandedFCRARules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  console.log('🔍 [EXPANDED-FCRA] Running expanded FCRA violation detection...');
  
  issues.push(...ruleFCRA611aDisputeNotNoted(report));
  issues.push(...ruleFCRA605cDisputeInProgress(report));
  issues.push(...ruleFCRA623aInaccurateInfo(report));
  issues.push(...ruleFCRA623bDirectDispute(report));
  issues.push(...ruleFCRA609Disclosure(report));
  issues.push(...ruleFCRA605Obsolete(report));
  issues.push(...ruleFCRA607ConsumerIdentity(report));
  issues.push(...ruleFCRA615AdverseAction(report));
  issues.push(...ruleFCRA616CivilLiability(report));
  issues.push(...ruleCreditorNameVerification(report));
  issues.push(...ruleBalanceAccuracy(report));
  issues.push(...ruleCreditLimitReporting(report));
  issues.push(...rulePaymentStatusConsistency(report));
  issues.push(...ruleDateReportingAccuracy(report));
  issues.push(...ruleHighCreditAccuracy(report));
  issues.push(...rulePastDueAmountValidation(report));
  issues.push(...ruleAccountConditionCode(report));
  issues.push(...ruleSpecialCommentCodes(report));
  issues.push(...ruleComplianceConditionCodes(report));
  issues.push(...ruleConsumerStatementRights(report));
  issues.push(...rulePaymentHistoryGaps(report));
  issues.push(...rulePaymentHistoryImpossibleJumps(report));
  issues.push(...ruleMetro2StatusCodeViolations(report));
  issues.push(...ruleCollectionWithoutDOFD(report));
  issues.push(...ruleMedicalDebtReporting(report));
  
  console.log(`🔍 [EXPANDED-FCRA] Found ${issues.length} expanded FCRA violations`);
  return issues;
}

function ruleFCRA611aDisputeNotNoted(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      const statusStr = typeof tl.status === 'string' ? tl.status : '';
      if (statusStr.toLowerCase().includes('disputed') && !tl.remarks?.some(r => r?.toLowerCase().includes('dispute'))) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_611A_DISPUTE_NOT_NOTED',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'HIGH',
          statutes: ['FCRA_611'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} shows disputed status but lacks proper dispute notation per FCRA 611(a)`,
          explanationKey: 'FCRA_611A_DISPUTE_NOT_NOTED',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA605cDisputeInProgress(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const col of bureau.collections) {
      const statusStr = col.status || '';
      if (statusStr.toLowerCase().includes('open')) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_605C_COLLECTION_DISPUTABLE',
          family: 'FCRA_EXPANDED',
          category: 'Collection',
          severity: 'MEDIUM',
          statutes: ['FCRA_605c'],
          affectedEntityType: 'Collection',
          affectedBureaus: [bureau.bureau],
          affectedIds: [col.internalId],
          descriptionMachine: `Collection ${col.collectorName} for ${col.originalCreditorName || 'unknown creditor'} is an open collection eligible for dispute`,
          explanationKey: 'FCRA_605C_COLLECTION_DISPUTABLE',
          details: { bureau: bureau.bureau, collectorName: col.collectorName }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA623aInaccurateInfo(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.balance !== undefined && tl.balance < 0) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_623A_NEGATIVE_BALANCE',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'HIGH',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} reports impossible negative balance of $${tl.balance}`,
          explanationKey: 'FCRA_623A_NEGATIVE_BALANCE',
          details: { bureau: bureau.bureau, balance: tl.balance }
        }));
      }
      if (tl.creditLimit && tl.balance && tl.balance > tl.creditLimit * 2) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_623A_BALANCE_EXCEEDS_LIMIT',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} balance $${tl.balance} exceeds credit limit $${tl.creditLimit} by more than double`,
          explanationKey: 'FCRA_623A_BALANCE_EXCEEDS_LIMIT',
          details: { bureau: bureau.bureau, balance: tl.balance, creditLimit: tl.creditLimit }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA623bDirectDispute(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.status === 'ChargeOff') {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_623B_CHARGEOFF_DISPUTE_ELIGIBLE',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_623'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} is a charge-off eligible for direct dispute with furnisher under FCRA 623(b)`,
          explanationKey: 'FCRA_623B_CHARGEOFF_DISPUTE_ELIGIBLE',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA609Disclosure(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (!tl.openedDate) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_609_MISSING_DATE_OPENED',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_609'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} missing required date opened disclosure per FCRA 609`,
          explanationKey: 'FCRA_609_MISSING_DATE_OPENED',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA605Obsolete(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
  
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      const dofd = tl.dateOfFirstDelinquency ? new Date(tl.dateOfFirstDelinquency) : null;
      if (dofd && dofd < sevenYearsAgo && (tl.status === 'Delinquent' || tl.status === 'Late30' || tl.status === 'Late60' || tl.status === 'Late90')) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_605A_OBSOLETE_DELINQUENCY',
          family: 'FCRA_EXPANDED',
          category: 'Obsolete Data',
          severity: 'HIGH',
          statutes: ['FCRA_605a'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} delinquency from ${tl.dateOfFirstDelinquency} exceeds 7-year reporting limit`,
          explanationKey: 'FCRA_605A_OBSOLETE_DELINQUENCY',
          details: { bureau: bureau.bureau, dofd: tl.dateOfFirstDelinquency }
        }));
      }
    }
    for (const col of bureau.collections) {
      const dofd = col.dateOfFirstDelinquency ? new Date(col.dateOfFirstDelinquency) : null;
      if (dofd && dofd < sevenYearsAgo) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_605A_OBSOLETE_COLLECTION',
          family: 'FCRA_EXPANDED',
          category: 'Obsolete Data',
          severity: 'HIGH',
          statutes: ['FCRA_605a'],
          affectedEntityType: 'Collection',
          affectedBureaus: [bureau.bureau],
          affectedIds: [col.internalId],
          descriptionMachine: `Collection ${col.collectorName} from ${col.dateOfFirstDelinquency} exceeds 7-year reporting limit`,
          explanationKey: 'FCRA_605A_OBSOLETE_COLLECTION',
          details: { bureau: bureau.bureau, dofd: col.dateOfFirstDelinquency }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA607ConsumerIdentity(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (!tl.accountNumberMasked || tl.accountNumberMasked.length < 4) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_607_MISSING_ACCOUNT_ID',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_607b'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} lacks proper account identification per FCRA 607`,
          explanationKey: 'FCRA_607_MISSING_ACCOUNT_ID',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA615AdverseAction(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const inquiry of bureau.inquiries) {
      if (!inquiry.inquirerName) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_615_INQUIRY_NO_CREDITOR',
          family: 'FCRA_EXPANDED',
          category: 'Inquiry',
          severity: 'MEDIUM',
          statutes: ['FCRA_604'],
          affectedEntityType: 'Inquiry',
          affectedBureaus: [bureau.bureau],
          affectedIds: [inquiry.internalId],
          descriptionMachine: `Hard inquiry on ${inquiry.date} missing creditor name for adverse action notice purposes`,
          explanationKey: 'FCRA_615_INQUIRY_NO_CREDITOR',
          details: { bureau: bureau.bureau, date: inquiry.date }
        }));
      }
    }
  }
  return issues;
}

function ruleFCRA616CivilLiability(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.remarks?.some(r => r?.toLowerCase().includes('error'))) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_616_ACKNOWLEDGED_ERROR',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'HIGH',
          statutes: ['FCRA_623'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} contains acknowledged error creating civil liability under FCRA 616/617`,
          explanationKey: 'FCRA_616_ACKNOWLEDGED_ERROR',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleCreditorNameVerification(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (!tl.creditorName || tl.creditorName.toLowerCase() === 'unknown' || tl.creditorName.length < 2) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_CREDITOR_NAME_MISSING',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'HIGH',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Tradeline missing valid creditor name - cannot verify account ownership`,
          explanationKey: 'FCRA_CREDITOR_NAME_MISSING',
          details: { bureau: bureau.bureau }
        }));
      }
    }
    for (const col of bureau.collections) {
      if (!col.collectorName || col.collectorName.toLowerCase() === 'unknown') {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_COLLECTOR_NAME_MISSING',
          family: 'FCRA_EXPANDED',
          category: 'Collection',
          severity: 'HIGH',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Collection',
          affectedBureaus: [bureau.bureau],
          affectedIds: [col.internalId],
          descriptionMachine: `Collection account missing collector name - cannot verify debt ownership`,
          explanationKey: 'FCRA_COLLECTOR_NAME_MISSING',
          details: { bureau: bureau.bureau }
        }));
      }
    }
  }
  return issues;
}

function ruleBalanceAccuracy(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.status === 'Paid' && tl.balance && tl.balance > 0) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_PAID_WITH_BALANCE',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'HIGH',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} marked paid but shows balance of $${tl.balance}`,
          explanationKey: 'FCRA_PAID_WITH_BALANCE',
          details: { bureau: bureau.bureau, balance: tl.balance }
        }));
      }
      if (tl.status === 'Closed' && tl.balance && tl.balance > 0) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_CLOSED_WITH_BALANCE',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} marked closed but shows balance of $${tl.balance}`,
          explanationKey: 'FCRA_CLOSED_WITH_BALANCE',
          details: { bureau: bureau.bureau, balance: tl.balance }
        }));
      }
    }
  }
  return issues;
}

function ruleCreditLimitReporting(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.type === 'CreditCard' && !tl.creditLimit) {
        issues.push(createIssueFlag({
          ruleId: 'METRO2_MISSING_CREDIT_LIMIT',
          family: 'FCRA_EXPANDED',
          category: 'Metro2 Compliance',
          severity: 'MEDIUM',
          statutes: ['METRO2_BASE_SEGMENT'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Credit card account ${tl.creditorName} missing required credit limit per Metro2 standards`,
          explanationKey: 'METRO2_MISSING_CREDIT_LIMIT',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function rulePaymentStatusConsistency(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.paymentHistory && tl.paymentHistory.length > 0) {
        const lastPayment = tl.paymentHistory[tl.paymentHistory.length - 1];
        if (lastPayment.status === 'OK' && (tl.status === 'Late30' || tl.status === 'Late60' || tl.status === 'Late90' || tl.status === 'Delinquent')) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_PAYMENT_STATUS_CONFLICT',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} shows current payment history but delinquent account status`,
            explanationKey: 'FCRA_PAYMENT_STATUS_CONFLICT',
            details: { bureau: bureau.bureau, status: tl.status, lastPaymentStatus: lastPayment.status }
          }));
        }
      }
    }
  }
  return issues;
}

function ruleDateReportingAccuracy(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = new Date();
  
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.openedDate) {
        const opened = new Date(tl.openedDate);
        if (opened > today) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_FUTURE_DATE_OPENED',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} has impossible future date opened: ${tl.openedDate}`,
            explanationKey: 'FCRA_FUTURE_DATE_OPENED',
            details: { bureau: bureau.bureau, openedDate: tl.openedDate }
          }));
        }
      }
      if (tl.closedDate && tl.openedDate) {
        const opened = new Date(tl.openedDate);
        const closed = new Date(tl.closedDate);
        if (closed < opened) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_CLOSED_BEFORE_OPENED',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} closed ${tl.closedDate} before opened ${tl.openedDate}`,
            explanationKey: 'FCRA_CLOSED_BEFORE_OPENED',
            details: { bureau: bureau.bureau, openedDate: tl.openedDate, closedDate: tl.closedDate }
          }));
        }
      }
      if (tl.lastUpdatedDate) {
        const lastUpdated = new Date(tl.lastUpdatedDate);
        if (lastUpdated > today) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_FUTURE_LAST_UPDATED',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} has impossible future last updated date: ${tl.lastUpdatedDate}`,
            explanationKey: 'FCRA_FUTURE_LAST_UPDATED',
            details: { bureau: bureau.bureau, lastUpdatedDate: tl.lastUpdatedDate }
          }));
        }
      }
    }
  }
  return issues;
}

function ruleHighCreditAccuracy(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.highCreditLimit && tl.creditLimit && tl.highCreditLimit > tl.creditLimit * 1.5) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_HIGH_CREDIT_EXCEEDS_LIMIT',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'MEDIUM',
          statutes: ['FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} high credit $${tl.highCreditLimit} significantly exceeds limit $${tl.creditLimit}`,
          explanationKey: 'FCRA_HIGH_CREDIT_EXCEEDS_LIMIT',
          details: { bureau: bureau.bureau, highCreditLimit: tl.highCreditLimit, creditLimit: tl.creditLimit }
        }));
      }
    }
  }
  return issues;
}

function rulePastDueAmountValidation(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.pastDueAmount && tl.pastDueAmount > 0) {
        if (tl.status === 'Open' && !tl.paymentHistory?.some(p => p.status !== 'OK')) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_CURRENT_WITH_PAST_DUE',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} shows current status but has $${tl.pastDueAmount} past due`,
            explanationKey: 'FCRA_CURRENT_WITH_PAST_DUE',
            details: { bureau: bureau.bureau, pastDueAmount: tl.pastDueAmount }
          }));
        }
        if (tl.pastDueAmount > (tl.balance || 0)) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_PAST_DUE_EXCEEDS_BALANCE',
            family: 'FCRA_EXPANDED',
            category: 'Account Accuracy',
            severity: 'HIGH',
            statutes: ['FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} past due $${tl.pastDueAmount} exceeds balance $${tl.balance}`,
            explanationKey: 'FCRA_PAST_DUE_EXCEEDS_BALANCE',
            details: { bureau: bureau.bureau, pastDueAmount: tl.pastDueAmount, balance: tl.balance }
          }));
        }
      }
    }
  }
  return issues;
}

function ruleAccountConditionCode(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const col of bureau.collections) {
      if (col.balance === 0 && col.status === 'Open') {
        issues.push(createIssueFlag({
          ruleId: 'METRO2_ZERO_BALANCE_OPEN_COLLECTION',
          family: 'FCRA_EXPANDED',
          category: 'Collection',
          severity: 'HIGH',
          statutes: ['METRO2_BASE_SEGMENT'],
          affectedEntityType: 'Collection',
          affectedBureaus: [bureau.bureau],
          affectedIds: [col.internalId],
          descriptionMachine: `Collection ${col.collectorName} shows $0 balance but open status`,
          explanationKey: 'METRO2_ZERO_BALANCE_OPEN_COLLECTION',
          details: { bureau: bureau.bureau, collectorName: col.collectorName }
        }));
      }
    }
  }
  return issues;
}

function ruleSpecialCommentCodes(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.statusRaw?.toLowerCase().includes('settled') && !tl.remarks?.some(r => r?.toLowerCase().includes('settled'))) {
        issues.push(createIssueFlag({
          ruleId: 'METRO2_SETTLED_NO_COMMENT',
          family: 'FCRA_EXPANDED',
          category: 'Metro2 Compliance',
          severity: 'MEDIUM',
          statutes: ['METRO2_BASE_SEGMENT'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} settled but missing proper special comment code`,
          explanationKey: 'METRO2_SETTLED_NO_COMMENT',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleComplianceConditionCodes(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.forbearanceFlag && (tl.status === 'Late30' || tl.status === 'Late60' || tl.status === 'Late90' || tl.status === 'Delinquent')) {
        issues.push(createIssueFlag({
          ruleId: 'METRO2_FORBEARANCE_DELINQUENT',
          family: 'FCRA_EXPANDED',
          category: 'Metro2 Compliance',
          severity: 'HIGH',
          statutes: ['CARES_FORBEARANCE'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} in forbearance but reported as delinquent`,
          explanationKey: 'METRO2_FORBEARANCE_DELINQUENT',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function ruleConsumerStatementRights(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      const statusStr = typeof tl.status === 'string' ? tl.status : '';
      if (statusStr.toLowerCase().includes('disputed') && !tl.remarks?.some(r => r?.toLowerCase().includes('consumer'))) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_611C_CONSUMER_STATEMENT',
          family: 'FCRA_EXPANDED',
          category: 'Account Accuracy',
          severity: 'LOW',
          statutes: ['FCRA_611'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: [bureau.bureau],
          affectedIds: [tl.internalId],
          descriptionMachine: `Account ${tl.creditorName} disputed but consumer statement rights not noted`,
          explanationKey: 'FCRA_611C_CONSUMER_STATEMENT',
          details: { bureau: bureau.bureau, creditorName: tl.creditorName }
        }));
      }
    }
  }
  return issues;
}

function rulePaymentHistoryGaps(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.paymentHistory && tl.paymentHistory.length > 2) {
        const months = tl.paymentHistory.map(p => p.month).sort();
        for (let i = 1; i < months.length; i++) {
          const prev = new Date(months[i-1] + '-01');
          const curr = new Date(months[i] + '-01');
          const diffMonths = (curr.getFullYear() - prev.getFullYear()) * 12 + (curr.getMonth() - prev.getMonth());
          if (diffMonths > 2) {
            issues.push(createIssueFlag({
              ruleId: 'METRO2_PAYMENT_HISTORY_GAP',
              family: 'FCRA_EXPANDED',
              category: 'Metro2 Compliance',
              severity: 'MEDIUM',
              statutes: ['METRO2_BASE_SEGMENT'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [bureau.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine: `Account ${tl.creditorName} has ${diffMonths}-month gap in payment history between ${months[i-1]} and ${months[i]}`,
              explanationKey: 'METRO2_PAYMENT_HISTORY_GAP',
              details: { bureau: bureau.bureau, gapMonths: diffMonths }
            }));
            break;
          }
        }
      }
    }
  }
  return issues;
}

function rulePaymentHistoryImpossibleJumps(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.paymentHistory && tl.paymentHistory.length > 1) {
        for (let i = 1; i < tl.paymentHistory.length; i++) {
          const prev = tl.paymentHistory[i-1];
          const curr = tl.paymentHistory[i];
          if (prev.status === 'OK' && (curr.status === '90' || curr.status === '120' || curr.status === '150')) {
            issues.push(createIssueFlag({
              ruleId: 'METRO2_IMPOSSIBLE_PAYMENT_JUMP',
              family: 'FCRA_EXPANDED',
              category: 'Metro2 Compliance',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [bureau.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine: `Account ${tl.creditorName} shows impossible jump from current to ${curr.status} days late in payment history`,
              explanationKey: 'METRO2_IMPOSSIBLE_PAYMENT_JUMP',
              details: { bureau: bureau.bureau, previousStatus: prev.status, currentStatus: curr.status }
            }));
            break;
          }
        }
      }
    }
  }
  return issues;
}

function ruleMetro2StatusCodeViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const tl of bureau.tradelines) {
      if (tl.metro2) {
        if (tl.status === 'ChargeOff' && !tl.dateOfFirstDelinquency) {
          issues.push(createIssueFlag({
            ruleId: 'METRO2_CHARGEOFF_NO_DOFD',
            family: 'FCRA_EXPANDED',
            category: 'Metro2 Compliance',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Charge-off account ${tl.creditorName} missing required Date of First Delinquency`,
            explanationKey: 'METRO2_CHARGEOFF_NO_DOFD',
            details: { bureau: bureau.bureau, creditorName: tl.creditorName }
          }));
        }
        if (tl.metro2.accountStatusCode === '97' && tl.balance && tl.balance > 0) {
          issues.push(createIssueFlag({
            ruleId: 'METRO2_UNPAID_BALANCE_STATUS',
            family: 'FCRA_EXPANDED',
            category: 'Metro2 Compliance',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [bureau.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine: `Account ${tl.creditorName} has status 97 (unpaid) but shows balance $${tl.balance}`,
            explanationKey: 'METRO2_UNPAID_BALANCE_STATUS',
            details: { bureau: bureau.bureau, balance: tl.balance }
          }));
        }
      }
    }
  }
  return issues;
}

function ruleCollectionWithoutDOFD(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const col of bureau.collections) {
      if (!col.dateOfFirstDelinquency) {
        issues.push(createIssueFlag({
          ruleId: 'FCRA_COLLECTION_NO_DOFD',
          family: 'FCRA_EXPANDED',
          category: 'Collection',
          severity: 'HIGH',
          statutes: ['FCRA_605a'],
          affectedEntityType: 'Collection',
          affectedBureaus: [bureau.bureau],
          affectedIds: [col.internalId],
          descriptionMachine: `Collection ${col.collectorName} missing Date of First Delinquency required to calculate 7-year reporting limit`,
          explanationKey: 'FCRA_COLLECTION_NO_DOFD',
          details: { bureau: bureau.bureau, collectorName: col.collectorName }
        }));
      }
    }
  }
  return issues;
}

function ruleMedicalDebtReporting(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  for (const bureau of report.bureaus) {
    for (const col of bureau.collections) {
      if (col.isMedical) {
        if (col.balance && col.balance < 500) {
          issues.push(createIssueFlag({
            ruleId: 'FCRA_MEDICAL_DEBT_UNDER_500',
            family: 'FCRA_EXPANDED',
            category: 'Collection',
            severity: 'HIGH',
            statutes: ['FCRA_605b'],
            affectedEntityType: 'Collection',
            affectedBureaus: [bureau.bureau],
            affectedIds: [col.internalId],
            descriptionMachine: `Medical collection ${col.collectorName} for $${col.balance} under $500 should not be reported per FCRA amendments`,
            explanationKey: 'FCRA_MEDICAL_DEBT_UNDER_500',
            details: { bureau: bureau.bureau, balance: col.balance }
          }));
        }
        if (col.openedDate) {
          const opened = new Date(col.openedDate);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          if (opened > oneYearAgo) {
            issues.push(createIssueFlag({
              ruleId: 'FCRA_MEDICAL_DEBT_TOO_SOON',
              family: 'FCRA_EXPANDED',
              category: 'Collection',
              severity: 'HIGH',
              statutes: ['FCRA_605b'],
              affectedEntityType: 'Collection',
              affectedBureaus: [bureau.bureau],
              affectedIds: [col.internalId],
              descriptionMachine: `Medical collection ${col.collectorName} reported before 1-year waiting period`,
              explanationKey: 'FCRA_MEDICAL_DEBT_TOO_SOON',
              details: { bureau: bureau.bureau, openedDate: col.openedDate }
            }));
          }
        }
      }
    }
  }
  return issues;
}
