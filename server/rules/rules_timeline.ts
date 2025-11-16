import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { thresholds } from '../config/thresholds';
import { createIssueFlag, todayIso, yearsBetween } from './utils';

export function runTimelineRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...ruleObsoleteDerogatory(report));
  issues.push(...ruleObsoleteBankruptcy(report));
  return issues;
}

function ruleObsoleteDerogatory(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();

  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      if (!tl.dateOfFirstDelinquency) continue;
      const years = yearsBetween(tl.dateOfFirstDelinquency, today);
      if (!years) continue;
      if (years > thresholds.obsoleteDerogYears + thresholds.obsoleteBufferDays / 365.25) {
        issues.push(
          createIssueFlag({
            ruleId: 'TM_001_DEROG_OLDER_THAN_7Y_NON_BK',
            family: 'TIMELINE',
            category: 'OBSOLETE_DEROGATORY',
            severity: 'HIGH',
            statutes: ['FCRA_605'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              'Non-bankruptcy derogatory tradeline appears older than FCRA obsolescence period.',
            explanationKey: 'TM_OBSOLETE_DEROG',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
              yearsSinceDOFD: years,
            },
          }),
        );
      }
    }

    for (const col of b.collections) {
      if (!col.dateOfFirstDelinquency) continue;
      const years = yearsBetween(col.dateOfFirstDelinquency, today);
      if (!years) continue;
      if (years > thresholds.obsoleteDerogYears + thresholds.obsoleteBufferDays / 365.25) {
        issues.push(
          createIssueFlag({
            ruleId: 'TM_001_DEROG_OLDER_THAN_7Y_NON_BK',
            family: 'TIMELINE',
            category: 'OBSOLETE_DEROGATORY',
            severity: 'HIGH',
            statutes: ['FCRA_605'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              'Collection account appears older than FCRA obsolescence period.',
            explanationKey: 'TM_OBSOLETE_DEROG',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              dateOfFirstDelinquency: col.dateOfFirstDelinquency,
              yearsSinceDOFD: years,
            },
          }),
        );
      }
    }
  }
  return issues;
}

function ruleObsoleteBankruptcy(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const today = todayIso();

  for (const b of report.bureaus) {
    for (const pr of b.publicRecords) {
      if (pr.type !== 'Bankruptcy' || !pr.filedDate) continue;
      const years = yearsBetween(pr.filedDate, today);
      if (!years) continue;

      if (years > thresholds.obsoleteBankruptcyYears + thresholds.obsoleteBufferDays / 365.25) {
        issues.push(
          createIssueFlag({
            ruleId: 'TM_002_BK_OLDER_THAN_10Y',
            family: 'TIMELINE',
            category: 'OBSOLETE_BANKRUPTCY',
            severity: 'HIGH',
            statutes: ['FCRA_605'],
            affectedEntityType: 'PublicRecord',
            affectedBureaus: [b.bureau],
            affectedIds: [pr.internalId],
            descriptionMachine:
              'Bankruptcy public record appears older than FCRA reporting period.',
            explanationKey: 'TM_OBSOLETE_BK',
            details: {
              bureau: b.bureau,
              internalId: pr.internalId,
              filedDate: pr.filedDate,
              yearsSinceFiled: years,
            },
          }),
        );
      }
    }
  }
  return issues;
}
