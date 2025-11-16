import type { StatuteRef } from '../models/issues';

export const statuteDescriptions: Record<StatuteRef, { title: string; description: string }> = {
  FCRA_607b: {
    title: 'FCRA § 607(b) – Reasonable Procedures to Assure Maximum Possible Accuracy',
    description: 'Requires consumer reporting agencies to follow reasonable procedures to assure maximum possible accuracy of information.',
  },
  FCRA_611: {
    title: 'FCRA § 611 – Procedure in Case of Disputed Accuracy',
    description: 'Governs reinvestigation timelines and procedures when consumers dispute information.',
  },
  FCRA_623: {
    title: 'FCRA § 623 – Responsibilities of Furnishers of Information',
    description: 'Requires furnishers to provide accurate information and to correct, delete, or verify disputed information.',
  },
  FCRA_605: {
    title: 'FCRA § 605 – Requirements Relating to Information Contained in Consumer Reports',
    description: 'Sets time limits for negative information (obsolescence).',
  },
  FDCPA_807: {
    title: 'FDCPA § 807 – False or Misleading Representations',
    description: 'Prohibits false, deceptive, or misleading representations in debt collection.',
  },
  FDCPA_809: {
    title: 'FDCPA § 809 – Validation of Debts',
    description: 'Requires debt validation after consumer requests and restricts collection during disputes.',
  },
  METRO2: {
    title: 'Metro 2® Reporting Standards',
    description: 'Industry-standard format and coding guidance for furnishing credit information.',
  },
  CARES_FORBEARANCE: {
    title: 'CARES Act / Forbearance Reporting Guidance',
    description: 'Special reporting rules for accounts in accommodation or forbearance programs.',
  },
  STATE_LAW_OTHER: {
    title: 'State Law / Other Consumer Protection',
    description: 'Placeholder for state-specific or other consumer protection laws.',
  },
};
