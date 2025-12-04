import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, todayIso, yearsBetween, daysBetween } from './utils';

export function runComprehensiveFCRARules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  console.log('🔍 [FCRA] Running comprehensive FCRA violation detection...');
  
  issues.push(...ruleFCRA605aObsoleteData(report));
  issues.push(...ruleFCRA605bMedicalDebt(report));
  issues.push(...ruleFCRA609Verification(report));
  issues.push(...ruleFCRA611Reinvestigation(report));
  issues.push(...ruleFCRA623FurnisherDuties(report));
  issues.push(...ruleFCRA607Accuracy(report));
  issues.push(...ruleMissingRequiredDates(report));
  issues.push(...ruleInconsistentReporting(report));
  issues.push(...ruleUnauthorizedInquiries(report));
  issues.push(...ruleMixedFile(report));
  
  console.log(`🔍 [FCRA] Found ${issues.length} FCRA violations`);
  return issues;
}

function ruleFCRA605aObsoleteData(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const delinqDate = tl.dateOfFirstDelinquency || tl.openedDate;
      if (!delinqDate) continue;
      
      const years = yearsBetween(delinqDate, today);
      if (years === undefined) continue;
      
      const isNegative = ['ChargeOff', 'Collection', 'Repossession', 'Foreclosure', 
                          'Late30', 'Late60', 'Late90', 'Late120', 'Late150Plus', 'Delinquent'].includes(tl.status);
      
      if (isNegative && years > 7) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_605A_OBSOLETE_NEGATIVE',
            family: 'FCRA',
            category: 'OBSOLETE_DATA',
            severity: 'CRITICAL',
            statutes: ['FCRA_605a', '15_USC_1681c'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} negative account is over 7 years old (${Math.round(years)} years). Under FCRA §605(a), negative information cannot be reported beyond 7 years from the date of first delinquency. This item must be removed.`,
            explanationKey: 'FCRA_OBSOLETE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              status: tl.status,
              dateOfFirstDelinquency: delinqDate,
              yearsSinceDOFD: Math.round(years),
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
    
    for (const col of b.collections) {
      const delinqDate = col.dateOfFirstDelinquency || col.openedDate;
      if (!delinqDate) continue;
      
      const years = yearsBetween(delinqDate, today);
      if (years === undefined) continue;
      
      if (years > 7) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_605A_OBSOLETE_COLLECTION',
            family: 'FCRA',
            category: 'OBSOLETE_DATA',
            severity: 'CRITICAL',
            statutes: ['FCRA_605a', '15_USC_1681c'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is over 7 years old. Under FCRA §605(a), collection accounts cannot be reported beyond 7 years from the date of first delinquency on the original debt. This must be removed.`,
            explanationKey: 'FCRA_OBSOLETE_COLLECTION',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              originalCreditor: col.originalCreditorName,
              dateOfFirstDelinquency: delinqDate,
              yearsSinceDOFD: Math.round(years),
              accountName: col.collectorName,
            },
          })
        );
      }
    }
    
    for (const pr of b.publicRecords) {
      if (!pr.filedDate) continue;
      const years = yearsBetween(pr.filedDate, today);
      if (years === undefined) continue;
      
      const isBankruptcy = pr.type === 'Bankruptcy';
      const maxYears = isBankruptcy ? 10 : 7;
      
      if (years > maxYears) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_605A_OBSOLETE_PUBLIC_RECORD',
            family: 'FCRA',
            category: 'OBSOLETE_DATA',
            severity: 'CRITICAL',
            statutes: ['FCRA_605a', '15_USC_1681c'],
            affectedEntityType: 'PublicRecord',
            affectedBureaus: [b.bureau],
            affectedIds: [pr.internalId],
            descriptionMachine:
              `${pr.type} record is over ${maxYears} years old. Under FCRA §605(a), ${isBankruptcy ? 'bankruptcies' : 'public records'} cannot be reported beyond ${maxYears} years. This must be removed.`,
            explanationKey: 'FCRA_OBSOLETE_PUBLIC_RECORD',
            details: {
              bureau: b.bureau,
              internalId: pr.internalId,
              type: pr.type,
              filedDate: pr.filedDate,
              yearsSinceFiled: Math.round(years),
              accountName: `${pr.type} Record`,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleFCRA605bMedicalDebt(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    for (const col of b.collections) {
      if (!col.isMedical) continue;
      
      if (col.balance && col.balance < 500) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_605B_MEDICAL_UNDER_500',
            family: 'FCRA',
            category: 'MEDICAL_DEBT_VIOLATION',
            severity: 'CRITICAL',
            statutes: ['FCRA_605b', '15_USC_1681c_a_6'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Medical collection under $500 should not be reported. Under FCRA §605(b) as amended, medical debts under $500 cannot appear on consumer credit reports.`,
            explanationKey: 'FCRA_MEDICAL_UNDER_500',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              collectorName: col.collectorName,
              balance: col.balance,
              accountName: col.collectorName,
            },
          })
        );
      }
      
      if (col.openedDate) {
        const daysSinceOpened = daysBetween(col.openedDate, today);
        if (daysSinceOpened !== undefined && daysSinceOpened < 365) {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_605B_MEDICAL_PREMATURE',
              family: 'FCRA',
              category: 'MEDICAL_DEBT_VIOLATION',
              severity: 'HIGH',
              statutes: ['FCRA_605b', '15_USC_1681c_a_6'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [col.internalId],
              descriptionMachine:
                `Medical collection reported before 1-year waiting period. Under FCRA §605(b), medical debts cannot be reported until at least 365 days after the date of first delinquency.`,
              explanationKey: 'FCRA_MEDICAL_PREMATURE',
              details: {
                bureau: b.bureau,
                internalId: col.internalId,
                collectorName: col.collectorName,
                openedDate: col.openedDate,
                daysSinceOpened,
                accountName: col.collectorName,
              },
            })
          );
        }
      }
    }
  }
  
  return issues;
}

function ruleFCRA609Verification(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (!tl.accountNumberMasked && !tl.furnisherId) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_609_UNVERIFIABLE_ACCOUNT',
            family: 'FCRA',
            category: 'VERIFICATION_FAILURE',
            severity: 'HIGH',
            statutes: ['FCRA_609', 'FCRA_611', '15_USC_1681g', '15_USC_1681i'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} account lacks account number and furnisher ID, making verification impossible. Under FCRA §609, consumers have the right to request verification of any reported information, and under §611, unverifiable information must be deleted.`,
            explanationKey: 'FCRA_UNVERIFIABLE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
    
    for (const col of b.collections) {
      if (!col.originalCreditorName) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_609_MISSING_ORIGINAL_CREDITOR',
            family: 'FCRA',
            category: 'VERIFICATION_FAILURE',
            severity: 'HIGH',
            statutes: ['FCRA_609', 'FDCPA_809', '15_USC_1681g'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} does not identify the original creditor. Under FCRA §609 and FDCPA §809, the original creditor must be identified for the debt to be verifiable.`,
            explanationKey: 'FCRA_MISSING_ORIGINAL_CREDITOR',
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

function ruleFCRA611Reinvestigation(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (tl.metro2?.consumerInformationIndicator === 'D') {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_611_DISPUTED_ITEM',
            family: 'FCRA',
            category: 'DISPUTE_STATUS',
            severity: 'MEDIUM',
            statutes: ['FCRA_611', '15_USC_1681i'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} account is marked as disputed. Under FCRA §611, the bureau must conduct a reinvestigation within 30 days and provide results to the consumer. If you have not received dispute results, request them or file a complaint.`,
            explanationKey: 'FCRA_DISPUTE_PENDING',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              disputeIndicator: tl.metro2?.consumerInformationIndicator,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleFCRA623FurnisherDuties(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const balance = tl.balance ?? 0;
      const pastDue = tl.pastDueAmount ?? 0;
      
      if (pastDue > balance && balance > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_623_PAST_DUE_EXCEEDS_BALANCE',
            family: 'FCRA',
            category: 'INACCURATE_REPORTING',
            severity: 'HIGH',
            statutes: ['FCRA_623a1', '15_USC_1681s_2'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} shows past due amount ($${pastDue}) exceeding total balance ($${balance}). Under FCRA §623(a)(1), furnishers must report accurate information. This mathematical impossibility is an FCRA violation.`,
            explanationKey: 'FCRA_PAST_DUE_EXCEEDS_BALANCE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              balance,
              pastDueAmount: pastDue,
              accountName: tl.creditorName,
            },
          })
        );
      }
      
      if (tl.status === 'Paid' || tl.status === 'Closed') {
        if (balance > 0 || pastDue > 0) {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_623_PAID_WITH_BALANCE',
              family: 'FCRA',
              category: 'INACCURATE_REPORTING',
              severity: 'HIGH',
              statutes: ['FCRA_623a1', '15_USC_1681s_2'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `${tl.creditorName} is marked as ${tl.status} but still shows a balance of $${balance}. Under FCRA §623(a)(1), this contradictory reporting is inaccurate and must be corrected.`,
              explanationKey: 'FCRA_PAID_WITH_BALANCE',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                creditorName: tl.creditorName,
                status: tl.status,
                balance,
                pastDueAmount: pastDue,
                accountName: tl.creditorName,
              },
            })
          );
        }
      }
      
      const isNegative = ['ChargeOff', 'Collection', 'Late60', 'Late90', 'Late120', 'Late150Plus', 'Delinquent'].includes(tl.status);
      if (isNegative && !tl.dateOfFirstDelinquency) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_623_MISSING_DOFD',
            family: 'FCRA',
            category: 'MISSING_REQUIRED_DATA',
            severity: 'HIGH',
            statutes: ['FCRA_623a5', '15_USC_1681s_2'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} shows ${tl.status} status but is missing the Date of First Delinquency. Under FCRA §623(a)(5), furnishers MUST report the DOFD for any delinquent account. Without DOFD, the 7-year reporting period cannot be calculated.`,
            explanationKey: 'FCRA_MISSING_DOFD',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              status: tl.status,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
    
    for (const col of b.collections) {
      if (!col.dateOfFirstDelinquency) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_623_COLLECTION_MISSING_DOFD',
            family: 'FCRA',
            category: 'MISSING_REQUIRED_DATA',
            severity: 'CRITICAL',
            statutes: ['FCRA_623a5', '15_USC_1681s_2'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection from ${col.collectorName} is missing the Date of First Delinquency. Under FCRA §623(a)(5), this is a MANDATORY field for all collection accounts. Without it, the collection is unverifiable and should be deleted.`,
            explanationKey: 'FCRA_COLLECTION_MISSING_DOFD',
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

function ruleFCRA607Accuracy(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (tl.openedDate && tl.closedDate) {
        const openDate = new Date(tl.openedDate);
        const closeDate = new Date(tl.closedDate);
        
        if (closeDate < openDate) {
          issues.push(
            createIssueFlag({
              ruleId: 'FCRA_607_IMPOSSIBLE_DATES',
              family: 'FCRA',
              category: 'INACCURATE_REPORTING',
              severity: 'HIGH',
              statutes: ['FCRA_607b', '15_USC_1681e_b'],
              affectedEntityType: 'Tradeline',
              affectedBureaus: [b.bureau],
              affectedIds: [tl.internalId],
              descriptionMachine:
                `${tl.creditorName} shows close date (${tl.closedDate}) before open date (${tl.openedDate}). Under FCRA §607(b), credit bureaus must maintain reasonable procedures to ensure maximum possible accuracy. This impossible date sequence is a clear violation.`,
              explanationKey: 'FCRA_IMPOSSIBLE_DATES',
              details: {
                bureau: b.bureau,
                internalId: tl.internalId,
                creditorName: tl.creditorName,
                openedDate: tl.openedDate,
                closedDate: tl.closedDate,
                accountName: tl.creditorName,
              },
            })
          );
        }
      }
      
      const creditLimit = tl.creditLimit ?? tl.highCreditLimit ?? 0;
      const balance = tl.balance ?? 0;
      
      if (creditLimit > 0 && balance > creditLimit * 2) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_607_IMPOSSIBLE_BALANCE',
            family: 'FCRA',
            category: 'INACCURATE_REPORTING',
            severity: 'HIGH',
            statutes: ['FCRA_607b', '15_USC_1681e_b'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} shows balance ($${balance}) exceeding double the credit limit ($${creditLimit}). This improbable balance suggests reporting errors. Under FCRA §607(b), bureaus must ensure accuracy.`,
            explanationKey: 'FCRA_IMPOSSIBLE_BALANCE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              balance,
              creditLimit,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleMissingRequiredDates(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (!tl.openedDate) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_MISSING_OPEN_DATE',
            family: 'METRO2',
            category: 'INCOMPLETE_DATA',
            severity: 'MEDIUM',
            statutes: ['FCRA_623', 'METRO2_BASE_SEGMENT'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} is missing the account open date, which is a required field under Metro 2 reporting standards. This makes the account age and history unverifiable.`,
            explanationKey: 'METRO2_MISSING_OPEN_DATE',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              accountName: tl.creditorName,
            },
          })
        );
      }
      
      if (!tl.lastUpdatedDate) {
        issues.push(
          createIssueFlag({
            ruleId: 'METRO2_MISSING_LAST_UPDATED',
            family: 'METRO2',
            category: 'INCOMPLETE_DATA',
            severity: 'LOW',
            statutes: ['FCRA_623', 'METRO2_BASE_SEGMENT'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${tl.creditorName} is missing the last updated date. Furnishers should update account information monthly per Metro 2 standards.`,
            explanationKey: 'METRO2_MISSING_LAST_UPDATED',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              creditorName: tl.creditorName,
              accountName: tl.creditorName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleInconsistentReporting(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  const accountMap = new Map<string, { bureau: string; balance: number; status: string; creditorName: string; internalId: string }[]>();
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const key = (tl.creditorName || '').toLowerCase().trim() + '|' + (tl.accountNumberMasked || '');
      if (!accountMap.has(key)) {
        accountMap.set(key, []);
      }
      accountMap.get(key)!.push({
        bureau: b.bureau,
        balance: tl.balance ?? 0,
        status: tl.status,
        creditorName: tl.creditorName,
        internalId: tl.internalId,
      });
    }
  }
  
  for (const [key, entries] of Array.from(accountMap.entries())) {
    if (entries.length < 2) continue;
    
    const balances = entries.map(e => e.balance);
    const maxBalance = Math.max(...balances);
    const minBalance = Math.min(...balances);
    
    if (maxBalance > 0 && minBalance >= 0 && maxBalance - minBalance > 100) {
      const highEntry = entries.find(e => e.balance === maxBalance)!;
      const lowEntry = entries.find(e => e.balance === minBalance)!;
      
      issues.push(
        createIssueFlag({
          ruleId: 'FCRA_607_INCONSISTENT_BALANCES',
          family: 'FCRA',
          category: 'INCONSISTENT_REPORTING',
          severity: 'HIGH',
          statutes: ['FCRA_607b', 'FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: entries.map(e => e.bureau as any),
          affectedIds: entries.map(e => e.internalId),
          descriptionMachine:
            `${highEntry.creditorName} is reporting different balances across bureaus: $${minBalance} on ${lowEntry.bureau} vs $${maxBalance} on ${highEntry.bureau}. Under FCRA §607(b), information must be consistent across all bureaus.`,
          explanationKey: 'FCRA_INCONSISTENT_BALANCES',
          details: {
            creditorName: highEntry.creditorName,
            balances: entries.map(e => ({ bureau: e.bureau, balance: e.balance })),
            accountName: highEntry.creditorName,
          },
        })
      );
    }
    
    const statuses = new Set(entries.map(e => e.status));
    if (statuses.size > 1) {
      issues.push(
        createIssueFlag({
          ruleId: 'FCRA_607_INCONSISTENT_STATUS',
          family: 'FCRA',
          category: 'INCONSISTENT_REPORTING',
          severity: 'HIGH',
          statutes: ['FCRA_607b', 'FCRA_623a1'],
          affectedEntityType: 'Tradeline',
          affectedBureaus: entries.map(e => e.bureau as any),
          affectedIds: entries.map(e => e.internalId),
          descriptionMachine:
            `${entries[0].creditorName} is reporting different statuses across bureaus: ${Array.from(statuses).join(', ')}. Under FCRA, the same account should have consistent status reporting.`,
          explanationKey: 'FCRA_INCONSISTENT_STATUS',
          details: {
            creditorName: entries[0].creditorName,
            statuses: entries.map(e => ({ bureau: e.bureau, status: e.status })),
            accountName: entries[0].creditorName,
          },
        })
      );
    }
  }
  
  return issues;
}

function ruleUnauthorizedInquiries(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();
  
  for (const b of report.bureaus) {
    const hardInquiries = b.inquiries.filter(i => i.type === 'Hard');
    
    const inquiryCountLast6Months = hardInquiries.filter(i => {
      const days = daysBetween(i.date, today);
      return days !== undefined && days <= 180;
    }).length;
    
    if (inquiryCountLast6Months > 6) {
      issues.push(
        createIssueFlag({
          ruleId: 'FCRA_604_EXCESSIVE_INQUIRIES',
          family: 'FCRA',
          category: 'INQUIRY_VIOLATION',
          severity: 'MEDIUM',
          statutes: ['FCRA_604', '15_USC_1681b'],
          affectedEntityType: 'Inquiry',
          affectedBureaus: [b.bureau],
          affectedIds: hardInquiries.slice(0, 5).map(i => i.internalId),
          descriptionMachine:
            `${inquiryCountLast6Months} hard inquiries in the last 6 months on ${b.bureau}. Each inquiry must have permissible purpose under FCRA §604. Consider disputing any inquiry you did not authorize.`,
          explanationKey: 'FCRA_EXCESSIVE_INQUIRIES',
          details: {
            bureau: b.bureau,
            inquiryCount: inquiryCountLast6Months,
            inquiries: hardInquiries.slice(0, 5).map(i => ({ name: i.inquirerName, date: i.date })),
            accountName: 'Hard Inquiries',
          },
        })
      );
    }
    
    for (const inq of hardInquiries) {
      const years = yearsBetween(inq.date, today);
      if (years !== undefined && years > 2) {
        issues.push(
          createIssueFlag({
            ruleId: 'FCRA_605_OBSOLETE_INQUIRY',
            family: 'FCRA',
            category: 'OBSOLETE_INQUIRY',
            severity: 'HIGH',
            statutes: ['FCRA_605a', '15_USC_1681c'],
            affectedEntityType: 'Inquiry',
            affectedBureaus: [b.bureau],
            affectedIds: [inq.internalId],
            descriptionMachine:
              `Hard inquiry from ${inq.inquirerName} dated ${inq.date} is over 2 years old. Under FCRA §605(a), inquiries can only be reported for 2 years. This must be removed.`,
            explanationKey: 'FCRA_OBSOLETE_INQUIRY',
            details: {
              bureau: b.bureau,
              internalId: inq.internalId,
              inquirerName: inq.inquirerName,
              date: inq.date,
              yearsSinceInquiry: Math.round(years),
              accountName: inq.inquirerName,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleMixedFile(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  const names = new Set<string>();
  const ssns = new Set<string>();
  
  if (report.consumer.fullName) {
    names.add(report.consumer.fullName.toLowerCase().trim());
  }
  if (report.consumer.otherNames) {
    for (const name of report.consumer.otherNames) {
      names.add(name.toLowerCase().trim());
    }
  }
  if (report.consumer.ssnLast4) {
    ssns.add(report.consumer.ssnLast4);
  }
  
  if (names.size > 3) {
    issues.push(
      createIssueFlag({
        ruleId: 'FCRA_605_MIXED_FILE_NAMES',
        family: 'FCRA',
        category: 'IDENTITY_ERROR',
        severity: 'CRITICAL',
        statutes: ['FCRA_607b', 'FCRA_611', '15_USC_1681e_b'],
        affectedEntityType: 'Consumer',
        affectedBureaus: report.bureaus.map(b => b.bureau),
        affectedIds: ['consumer_identity'],
        descriptionMachine:
          `Credit report shows ${names.size} different names, suggesting possible mixed file. Under FCRA §607(b), bureaus must use reasonable procedures to prevent mixing files of different consumers. This requires immediate investigation.`,
        explanationKey: 'FCRA_MIXED_FILE',
        details: {
          nameCount: names.size,
          names: Array.from(names),
          accountName: 'Consumer Identity',
        },
      })
    );
  }
  
  return issues;
}
