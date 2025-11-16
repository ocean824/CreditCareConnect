import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag } from './utils';

export function runIdentityRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  issues.push(...rulePublicRecordInUnknownState(report));
  return issues;
}

function rulePublicRecordInUnknownState(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  const knownStates = new Set(report.consumer.addresses.map(a => a.state.toUpperCase()));

  for (const b of report.bureaus) {
    for (const pr of b.publicRecords) {
      if (!pr.courtName) continue;
      const court = pr.courtName.toUpperCase();
      const matchesKnownState = Array.from(knownStates).some(state =>
        court.includes(state),
      );

      if (!matchesKnownState && knownStates.size > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'ID_006_PUBLIC_RECORD_IN_DIFFERENT_STATE_WITHOUT_ADDRESS_HISTORY',
            family: 'IDENTITY',
            category: 'PUBLIC_RECORD_OUT_OF_STATE',
            severity: 'MEDIUM',
            statutes: ['FCRA_607b'],
            affectedEntityType: 'PublicRecord',
            affectedBureaus: [b.bureau],
            affectedIds: [pr.internalId],
            descriptionMachine:
              'Public record appears to be from a jurisdiction not present in consumer address history.',
            explanationKey: 'ID_PUBLIC_RECORD_OUT_OF_STATE',
            details: {
              bureau: b.bureau,
              internalId: pr.internalId,
              courtName: pr.courtName,
              knownStates: Array.from(knownStates),
            },
          }),
        );
      }
    }
  }
  return issues;
}
