import type { CreditReport, Tradeline, CollectionAccount, BureauName } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, todayIso, yearsBetween, daysBetween, monthsBetween } from './utils';

export function runMetro2Rules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  console.log('🔍 [METRO2] Running comprehensive Metro2 violation detection...');
  
  issues.push(...ruleM2BaseSegmentViolations(report));
  issues.push(...ruleM2AccountStatusViolations(report));
  issues.push(...ruleM2PaymentRatingViolations(report));
  issues.push(...ruleM2DateViolations(report));
  issues.push(...ruleM2BalanceLimitViolations(report));
  issues.push(...ruleM2CollectionSegmentViolations(report));
  issues.push(...ruleM2ConsistencyViolations(report));
  issues.push(...ruleM2ComplianceConditionViolations(report));
  
  console.log(`🔍 [METRO2] Found ${issues.length} Metro2 violations`);
  return issues;
}

function ruleM2BaseSegmentViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const missingFields: string[] = [];
      
      if (!tl.accountNumberMasked) missingFields.push('Account Number');
      if (!tl.creditorName) missingFields.push('Creditor Name');
      if (!tl.openedDate) missingFields.push('Date Opened');
      if (!tl.type) missingFields.push('Account Type');
      
      if (missingFields.length > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_BASE_SEGMENT_MISSING_REQUIRED',
            family: 'METRO2',
            category: 'DATA_INTEGRITY',
            severity: missingFields.length >= 2 ? 'HIGH' : 'MEDIUM',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName || 'Unknown'} is missing required Metro 2 Base Segment fields: ${missingFields.join(', ')}. Under Metro 2 format standards and FCRA §623(a), furnishers must report complete and accurate account information.`,
            explanationKey: 'METRO2_INCOMPLETE_BASE_SEGMENT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              missingFields,
              missingCount: missingFields.length,
            },
          })
        );
      }
      
      // Check Metro2 snapshot fields
      if (tl.metro2) {
        if (tl.metro2.accountStatusCode && !isValidAccountStatusCode(tl.metro2.accountStatusCode)) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_INVALID_STATUS_CODE',
              family: 'METRO2',
              category: 'DATA_INTEGRITY',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} has invalid Metro 2 Account Status Code "${tl.metro2.accountStatusCode}". Valid codes include: 11 (Current), 71-84 (Delinquent), 93 (Collection), 97 (Loss).`,
              explanationKey: 'METRO2_INVALID_STATUS_CODE',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                statusCode: tl.metro2.accountStatusCode,
              },
            })
          );
        }
        
        if (tl.metro2.paymentRatingCode && !isValidPaymentRating(tl.metro2.paymentRatingCode)) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_INVALID_PAYMENT_RATING',
              family: 'METRO2',
              category: 'DATA_INTEGRITY',
              severity: 'MEDIUM',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} has invalid Metro 2 Payment Rating Code "${tl.metro2.paymentRatingCode}". Valid codes are 0-9 or B, C, D, E, G, H, J, K, L.`,
              explanationKey: 'METRO2_INVALID_PAYMENT_RATING',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                paymentRating: tl.metro2.paymentRatingCode,
              },
            })
          );
        }
      }
    }
  }
  
  return issues;
}

function isValidAccountStatusCode(code: string): boolean {
  const validCodes = [
    '05', '11', '13', '61', '62', '63', '64', '65',
    '71', '78', '80', '82', '83', '84', '88', '89',
    '93', '94', '95', '96', '97', 'DA', 'DF'
  ];
  return validCodes.includes(code.toUpperCase());
}

function isValidPaymentRating(code: string): boolean {
  const validCodes = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'B', 'C', 'D', 'E', 'G', 'H', 'J', 'K', 'L'];
  return validCodes.includes(code.toUpperCase());
}

function ruleM2AccountStatusViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const status = tl.status;
      const balance = tl.balance ?? 0;
      
      // Paid/Closed status with balance
      if (['Paid', 'Closed'].includes(status)) {
        if (balance > 0) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_STATUS_BALANCE_CONFLICT',
              family: 'METRO2',
              category: 'STATUS_CODE',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} reports status "${status}" but still shows balance of $${balance}. Under Metro 2 standards, Account Status Code must be consistent with Current Balance field.`,
              explanationKey: 'METRO2_STATUS_BALANCE_MISMATCH',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                status,
                balance,
              },
            })
          );
        }
      }
      
      // ChargeOff status but no closed date
      if (status === 'ChargeOff') {
        if (!tl.closedDate) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_CHARGEOFF_NO_DATE',
              family: 'METRO2',
              category: 'STATUS_CODE',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} reports charge-off status but is missing the Date Closed field. Metro 2 requires charge-off date to be reported for status code 97 (Unpaid balance reported as loss).`,
              explanationKey: 'METRO2_CHARGEOFF_MISSING_DATE',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                status,
              },
            })
          );
        }
      }
      
      // Transfer/Sold status verification
      if (['Transferred', 'Sold'].includes(status)) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_TRANSFER_VERIFICATION',
            family: 'METRO2',
            category: 'STATUS_CODE',
            severity: 'MEDIUM',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623', 'FDCPA_809'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows ${status} status. Under Metro 2 guidelines, Status Code 05 (Transfer/Sold) must include proper K1 segment with purchaser information. Verify chain of ownership is documented.`,
            explanationKey: 'METRO2_TRANSFER_DOCUMENTATION',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              status,
            },
          })
        );
      }
      
      // Late status without DOFD
      if (['Late30', 'Late60', 'Late90', 'Late120', 'Late150Plus', 'Delinquent'].includes(status)) {
        if (!tl.dateOfFirstDelinquency) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_DELINQUENT_NO_DOFD',
              family: 'METRO2',
              category: 'STATUS_CODE',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} shows delinquent status "${status}" but is missing Date of First Delinquency. Metro 2 requires DOFD for all delinquent accounts to calculate 7-year reporting limit.`,
              explanationKey: 'METRO2_MISSING_DOFD',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                status,
              },
            })
          );
        }
      }
    }
    
    // Collection status violations
    for (const col of b.collections) {
      if (!col.status) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_COLLECTION_NO_STATUS',
            family: 'METRO2',
            category: 'STATUS_CODE',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is missing Account Status Code. Metro 2 requires all collection accounts to report valid status code (typically 93 - Account Assigned to Collection).`,
            explanationKey: 'METRO2_MISSING_STATUS',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              accountName: col.collectorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleM2PaymentRatingViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const history = tl.paymentHistory || [];
      if (history.length > 0) {
        // Check for impossible payment patterns
        const hasNegative = history.some(h => ['30', '60', '90', '120', '150', 'CO'].includes(h.status));
        const hasCurrent = history.some(h => h.status === 'OK');
        
        if (hasNegative && hasCurrent && history.length >= 2) {
          for (let i = 1; i < history.length; i++) {
            const prev = history[i-1]?.status || '';
            const curr = history[i]?.status || '';
            
            // Jump from severely delinquent (120+/CO) to OK without intermediate
            if (['120', '150', 'CO'].includes(prev) && curr === 'OK') {
              issues.push(
                createIssueFlag({
                  ruleId: 'METRO2_PAYMENT_RATING_IMPOSSIBLE_JUMP',
                  family: 'METRO2',
                  category: 'PAYMENT_RATING',
                  severity: 'HIGH',
                  statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
                  affectedEntityType: 'Tradeline',
                  affectedBureaus: [b.bureau],
                  affectedIds: [tl.internalId],
                  descriptionMachine:
                    `Account ${tl.creditorName} shows impossible payment rating jump from "${prev}" (severely delinquent) to "${curr}" (current). Metro 2 Payment Rating Profile must show logical progression.`,
                  explanationKey: 'METRO2_IMPOSSIBLE_PAYMENT_PATTERN',
                  details: {
                    bureau: b.bureau,
                    internalId: tl.internalId,
                    accountName: tl.creditorName,
                    previousRating: prev,
                    currentRating: curr,
                  },
                })
              );
              break;
            }
          }
        }
        
        // Check for gaps in payment history
        for (let i = 1; i < history.length; i++) {
          const prevMonth = history[i-1]?.month;
          const currMonth = history[i]?.month;
          
          if (prevMonth && currMonth) {
            const prevDate = new Date(prevMonth + '-01');
            const currDate = new Date(currMonth + '-01');
            const monthDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 + 
                             (currDate.getMonth() - prevDate.getMonth());
            
            if (Math.abs(monthDiff) > 2) {
              issues.push(
                createIssueFlag({
                  ruleId: 'METRO2_PAYMENT_HISTORY_GAP',
                  family: 'METRO2',
                  category: 'PAYMENT_RATING',
                  severity: 'MEDIUM',
                  statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
                  affectedEntityType: 'Tradeline',
                  affectedBureaus: [b.bureau],
                  affectedIds: [tl.internalId],
                  descriptionMachine:
                    `Account ${tl.creditorName} has gap in payment history between ${prevMonth} and ${currMonth}. Metro 2 requires continuous monthly reporting.`,
                  explanationKey: 'METRO2_PAYMENT_HISTORY_INCOMPLETE',
                  details: {
                    bureau: b.bureau,
                    internalId: tl.internalId,
                    accountName: tl.creditorName,
                    gapStart: prevMonth,
                    gapEnd: currMonth,
                  },
                })
              );
              break;
            }
          }
        }
      }
    }
  }
  
  return issues;
}

function ruleM2DateViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      // Future dates
      if (tl.openedDate && tl.openedDate > today) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_FUTURE_OPEN_DATE',
            family: 'METRO2',
            category: 'DATE_FIELD',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Date Opened of ${tl.openedDate} which is in the future. Metro 2 Date Opened field cannot contain future dates.`,
            explanationKey: 'METRO2_INVALID_FUTURE_DATE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              dateField: 'Date Opened',
              dateValue: tl.openedDate,
            },
          })
        );
      }
      
      if (tl.closedDate && tl.closedDate > today) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_FUTURE_CLOSE_DATE',
            family: 'METRO2',
            category: 'DATE_FIELD',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Date Closed of ${tl.closedDate} which is in the future. Metro 2 Date Closed field cannot contain future dates.`,
            explanationKey: 'METRO2_INVALID_FUTURE_DATE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              dateField: 'Date Closed',
              dateValue: tl.closedDate,
            },
          })
        );
      }
      
      // Date consistency: closed before opened
      if (tl.openedDate && tl.closedDate && tl.closedDate < tl.openedDate) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_DATE_SEQUENCE_ERROR',
            family: 'METRO2',
            category: 'DATE_FIELD',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Date Closed (${tl.closedDate}) before Date Opened (${tl.openedDate}). Metro 2 date fields must be logically consistent.`,
            explanationKey: 'METRO2_DATE_SEQUENCE_VIOLATION',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              openedDate: tl.openedDate,
              closedDate: tl.closedDate,
            },
          })
        );
      }
      
      // DOFD before opened
      if (tl.dateOfFirstDelinquency && tl.openedDate && tl.dateOfFirstDelinquency < tl.openedDate) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_DOFD_BEFORE_OPEN',
            family: 'METRO2',
            category: 'DATE_FIELD',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Date of First Delinquency (${tl.dateOfFirstDelinquency}) before Date Opened (${tl.openedDate}). This is impossible and violates Metro 2 reporting standards.`,
            explanationKey: 'METRO2_DOFD_SEQUENCE_VIOLATION',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
              openedDate: tl.openedDate,
            },
          })
        );
      }
      
      // Last payment date validation
      if (tl.lastPaymentDate) {
        if (tl.lastPaymentDate > today) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_FUTURE_PAYMENT_DATE',
              family: 'METRO2',
              category: 'DATE_FIELD',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} shows Date of Last Payment (${tl.lastPaymentDate}) in the future. This is impossible and violates Metro 2 standards.`,
              explanationKey: 'METRO2_INVALID_FUTURE_DATE',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                dateField: 'Date of Last Payment',
                dateValue: tl.lastPaymentDate,
              },
            })
          );
        }
        
        if (tl.openedDate && tl.lastPaymentDate < tl.openedDate) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_PAYMENT_BEFORE_OPEN',
              family: 'METRO2',
              category: 'DATE_FIELD',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} shows Date of Last Payment (${tl.lastPaymentDate}) before Date Opened (${tl.openedDate}). This is impossible under Metro 2 standards.`,
              explanationKey: 'METRO2_DATE_SEQUENCE_VIOLATION',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                lastPaymentDate: tl.lastPaymentDate,
                openedDate: tl.openedDate,
              },
            })
          );
        }
      }
    }
    
    // Collection date violations
    for (const col of b.collections) {
      if (col.dateOfFirstDelinquency && col.openedDate) {
        if (col.dateOfFirstDelinquency > col.openedDate) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_COLLECTION_DOFD_AFTER_OPEN',
              family: 'METRO2',
              category: 'DATE_FIELD',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605', 'FCRA_623'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                `Collection from ${col.collectorName} shows DOFD (${col.dateOfFirstDelinquency}) after collection placement date (${col.openedDate}). The original delinquency must predate the collection.`,
              explanationKey: 'METRO2_COLLECTION_DATE_VIOLATION',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                accountName: col.collectorName,
                dateOfFirstDelinquency: col.dateOfFirstDelinquency,
                openedDate: col.openedDate,
              },
            })
          );
        }
      }
    }
  }
  
  return issues;
}

function ruleM2BalanceLimitViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const balance = tl.balance ?? 0;
      const limit = tl.creditLimit ?? 0;
      const highCredit = tl.highCreditLimit ?? 0;
      
      // Balance exceeds credit limit significantly
      if (limit > 0 && balance > limit * 1.5) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_BALANCE_EXCEEDS_LIMIT',
            family: 'METRO2',
            category: 'BALANCE_LIMIT',
            severity: 'MEDIUM',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Current Balance ($${balance}) significantly exceeds Credit Limit ($${limit}). Metro 2 requires balance fields to be accurately reported relative to credit limits.`,
            explanationKey: 'METRO2_BALANCE_LIMIT_INCONSISTENT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              balance,
              creditLimit: limit,
              excessAmount: balance - limit,
            },
          })
        );
      }
      
      // High credit lower than current balance
      if (highCredit > 0 && balance > highCredit) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_HIGH_CREDIT_ERROR',
            family: 'METRO2',
            category: 'BALANCE_LIMIT',
            severity: 'MEDIUM',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows Current Balance ($${balance}) exceeds High Credit ($${highCredit}). This is mathematically impossible and indicates Metro 2 reporting error.`,
            explanationKey: 'METRO2_HIGH_CREDIT_INCONSISTENT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              balance,
              highCredit,
            },
          })
        );
      }
      
      // Negative balance
      if (balance < 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_NEGATIVE_BALANCE',
            family: 'METRO2',
            category: 'BALANCE_LIMIT',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} shows negative balance of $${balance}. Metro 2 Current Balance field cannot be negative.`,
            explanationKey: 'METRO2_INVALID_BALANCE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              balance,
            },
          })
        );
      }
      
      // Missing credit limit for revolving accounts
      if (tl.type === 'CreditCard' && limit === 0 && balance > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_REVOLVING_NO_LIMIT',
            family: 'METRO2',
            category: 'BALANCE_LIMIT',
            severity: 'MEDIUM',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} is a credit card but shows no Credit Limit. Metro 2 requires Credit Limit for revolving accounts to calculate utilization properly.`,
            explanationKey: 'METRO2_MISSING_CREDIT_LIMIT',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              type: tl.type,
              balance,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleM2CollectionSegmentViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      // K1 Segment - Original Creditor Information
      if (!col.originalCreditorName) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_K1_MISSING_ORIGINAL_CREDITOR',
            family: 'METRO2',
            category: 'K1_SEGMENT',
            severity: 'HIGH',
            statutes: ['METRO2_K1_SEGMENT', 'FCRA_623', 'FDCPA_809'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is missing Metro 2 K1 Segment (Original Creditor Name). Under Metro 2 guidelines, K1 Segment is required when reporting collection accounts to identify the original creditor.`,
            explanationKey: 'METRO2_K1_REQUIRED',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      // K2 Segment - Purchased Portfolio Information
      const collectorLower = col.collectorName?.toLowerCase() || '';
      if (collectorLower.includes('portfolio') || collectorLower.includes('recovery') || 
          collectorLower.includes('debt buyer') || collectorLower.includes('fund') ||
          collectorLower.includes('capital') || collectorLower.includes('asset')) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_K2_PURCHASED_DEBT',
            family: 'METRO2',
            category: 'K2_SEGMENT',
            severity: 'MEDIUM',
            statutes: ['METRO2_K2_SEGMENT', 'FCRA_623', 'FDCPA_809'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} appears to be a debt buyer/portfolio recovery company. Metro 2 K2 Segment (Purchased Portfolio) is required to document chain of ownership and purchase date.`,
            explanationKey: 'METRO2_K2_REQUIRED',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      // Missing DOFD for collections
      if (!col.dateOfFirstDelinquency) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_COLLECTION_MISSING_DOFD',
            family: 'METRO2',
            category: 'K1_SEGMENT',
            severity: 'HIGH',
            statutes: ['METRO2_K1_SEGMENT', 'FCRA_605', 'FCRA_623'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is missing Date of First Delinquency (DOFD). Metro 2 requires DOFD to determine 7-year reporting limit under FCRA §605.`,
            explanationKey: 'METRO2_DOFD_REQUIRED',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      // Medical collections - check isMedical flag
      if (col.isMedical) {
        const balance = col.balance ?? 0;
        
        if (balance > 0 && balance < 500) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_MEDICAL_DEBT_UNDER_500',
              family: 'METRO2',
              category: 'COMPLIANCE_CONDITION',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605c', 'FCRA_623'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                `Medical collection from ${col.collectorName} for $${balance} should not be reported. Under recent FCRA amendments, medical debts under $500 cannot be included on credit reports.`,
              explanationKey: 'METRO2_MEDICAL_DEBT_PROHIBITED',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                accountName: col.collectorName,
                balance,
                originalCreditor: col.originalCreditorName,
              },
            })
          );
        }
        
        // Medical collection waiting period
        if (col.openedDate && col.dateOfFirstDelinquency) {
          const days = daysBetween(col.dateOfFirstDelinquency, col.openedDate);
          if (days !== undefined && days < 365) {
            issues.push(
              createIssueFlag({
                ruleId: 'METRO2_MEDICAL_COLLECTION_TOO_SOON',
                family: 'METRO2',
                category: 'COMPLIANCE_CONDITION',
                severity: 'HIGH',
                statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605c', 'FCRA_623'],
                affectedEntityType: 'Collection',
                affectedBureaus: [b.bureau],
                affectedIds: [col.internalId],
                descriptionMachine:
                  `Medical collection from ${col.collectorName} was reported ${Math.round(days)} days after delinquency. Medical debts cannot be reported until at least 1 year (365 days) after first delinquency.`,
                explanationKey: 'METRO2_MEDICAL_PREMATURE_REPORTING',
                details: {
                  bureau: b.bureau,
                  internalId: col.internalId,
                  accountName: col.collectorName,
                  daysToCollection: Math.round(days),
                  requiredWaitDays: 365,
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

function ruleM2ConsistencyViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  // Cross-bureau consistency check
  if (report.bureaus.length > 1) {
    const accountsByKey = new Map<string, Array<{bureau: BureauName, tl: Tradeline}>>();
    
    for (const b of report.bureaus) {
      for (const tl of b.tradelines) {
        const key = `${tl.creditorName?.toLowerCase().trim()}-${tl.accountNumberMasked?.slice(-4) || ''}`;
        if (!accountsByKey.has(key)) {
          accountsByKey.set(key, []);
        }
        accountsByKey.get(key)!.push({bureau: b.bureau, tl});
      }
    }
    
    for (const [key, accounts] of Array.from(accountsByKey.entries())) {
      if (accounts.length > 1) {
        // Check for balance discrepancies
        const balances = accounts.map(a => a.tl.balance ?? 0);
        const maxBalance = Math.max(...balances);
        const minBalance = Math.min(...balances);
        
        if (maxBalance > 0 && minBalance >= 0 && (maxBalance - minBalance) > maxBalance * 0.2) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_CROSS_BUREAU_BALANCE_DISCREPANCY',
              family: 'METRO2',
              category: 'CROSS_BUREAU',
              severity: 'MEDIUM',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: accounts.map(a => a.bureau),
              affectedIds: accounts.map(a => a.tl.internalId),
              descriptionMachine:
                `Account ${accounts[0].tl.creditorName} shows different balances across bureaus: ${accounts.map(a => `${a.bureau}: $${a.tl.balance}`).join(', ')}. Metro 2 requires consistent reporting to all bureaus.`,
              explanationKey: 'METRO2_INCONSISTENT_CROSS_BUREAU',
              details: {
                accountName: accounts[0].tl.creditorName,
                bureauData: accounts.map(a => ({
                  bureau: a.bureau,
                  balance: a.tl.balance,
                })),
                discrepancy: maxBalance - minBalance,
              },
            })
          );
        }
        
        // Check for status discrepancies
        const statuses = accounts.map(a => a.tl.status);
        const uniqueStatuses = Array.from(new Set(statuses));
        
        if (uniqueStatuses.length > 1) {
          const hasPositive = uniqueStatuses.some(s => ['Open', 'Paid', 'Closed'].includes(s));
          const hasNegative = uniqueStatuses.some(s => 
            ['ChargeOff', 'Collection', 'Repossession', 'Foreclosure', 
             'Late30', 'Late60', 'Late90', 'Late120', 'Late150Plus', 'Delinquent'].includes(s));
          
          if (hasPositive && hasNegative) {
            issues.push(
              createIssueFlag({
                ruleId: 'METRO2_CROSS_BUREAU_STATUS_CONFLICT',
                family: 'METRO2',
                category: 'CROSS_BUREAU',
                severity: 'HIGH',
                statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
                affectedEntityType: 'Tradeline',
                affectedBureaus: accounts.map(a => a.bureau),
                affectedIds: accounts.map(a => a.tl.internalId),
                descriptionMachine:
                  `Account ${accounts[0].tl.creditorName} shows conflicting statuses across bureaus: ${accounts.map(a => `${a.bureau}: ${a.tl.status}`).join(', ')}. Metro 2 requires uniform Account Status Code reporting.`,
                explanationKey: 'METRO2_STATUS_CROSS_BUREAU_CONFLICT',
                details: {
                  accountName: accounts[0].tl.creditorName,
                  bureauData: accounts.map(a => ({
                    bureau: a.bureau,
                    status: a.tl.status,
                  })),
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

function ruleM2ComplianceConditionViolations(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      // Forbearance violations
      if (tl.forbearanceFlag) {
        // Account in forbearance should not show delinquent
        if (['Late30', 'Late60', 'Late90', 'Late120', 'Late150Plus', 'Delinquent'].includes(tl.status)) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_FORBEARANCE_DELINQUENT',
              family: 'METRO2',
              category: 'COMPLIANCE_CONDITION',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'CARES_FORBEARANCE', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} is in forbearance but shows delinquent status "${tl.status}". Under CARES Act and Metro 2, accounts in forbearance must be reported as current.`,
              explanationKey: 'METRO2_FORBEARANCE_VIOLATION',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                status: tl.status,
                forbearanceStart: tl.forbearanceStart,
                forbearanceEnd: tl.forbearanceEnd,
              },
            })
          );
        }
      }
      
      // Hardship violations
      if (tl.hardshipFlag) {
        if (!tl.metro2?.specialCommentCode) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_HARDSHIP_NO_COMMENT',
              family: 'METRO2',
              category: 'COMPLIANCE_CONDITION',
              severity: 'MEDIUM',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} has hardship flag but is missing Metro 2 Special Comment Code. Hardship programs require proper Special Comment Code (AO, CP, etc.) to be reported.`,
              explanationKey: 'METRO2_MISSING_SPECIAL_COMMENT',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                hardshipDescription: tl.hardshipDescription,
              },
            })
          );
        }
      }
      
      // Closed accounts age check
      if (tl.status === 'Closed' && tl.balance === 0 && tl.closedDate) {
        const years = yearsBetween(tl.closedDate, today);
        if (years !== undefined && years > 10) {
          issues.push(
            createIssueFlag({
              ruleId: 'METRO2_OBSOLETE_CLOSED_ACCOUNT',
              family: 'METRO2',
              category: 'COMPLIANCE_CONDITION',
              severity: 'HIGH',
              statutes: ['METRO2_BASE_SEGMENT', 'FCRA_605'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `Account ${tl.creditorName} was closed ${Math.round(years)} years ago and may exceed maximum reporting period. Under FCRA §605 and Metro 2 guidelines, accounts must be removed after 7-10 years.`,
              explanationKey: 'METRO2_OBSOLETE_REPORTING',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                accountName: tl.creditorName,
                closedDate: tl.closedDate,
                yearsSinceClosed: Math.round(years),
              },
            })
          );
        }
      }
    }
  }
  
  return issues;
}
