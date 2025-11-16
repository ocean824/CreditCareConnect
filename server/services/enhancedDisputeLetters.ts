import {
  buildBureauDisputeLetters,
  buildCollectorDisputeLetters,
  type ConsumerContact,
  type BureauContact,
  type CollectorContact,
  type AiIssueExplanation,
  type DisputeLetter,
} from "../ai/disputeLetterGenerator";
import type { CreditReport, BureauName } from "../models/creditReport";
import type { IssueFlag } from "../models/issues";

const BUREAU_ADDRESSES: BureauContact[] = [
  {
    bureau: "Equifax",
    name: "Equifax Information Services LLC",
    addressLines: ["P.O. Box 740256", "Atlanta, GA 30374"],
  },
  {
    bureau: "TransUnion",
    name: "TransUnion Consumer Solutions",
    addressLines: ["P.O. Box 2000", "Chester, PA 19016"],
  },
  {
    bureau: "Experian",
    name: "Experian",
    addressLines: ["P.O. Box 4500", "Allen, TX 75013"],
  },
];

export interface EnhancedLetterGenerationParams {
  report: CreditReport;
  issues: IssueFlag[];
  aiExplanations: AiIssueExplanation[];
  userInfo: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dob?: string;
    ssnLast4?: string;
  };
  bureauFilter?: BureauName[];
}

export interface GeneratedLetter {
  bureau?: BureauName;
  collectorName?: string;
  subject: string;
  content: string;
  affectedIssueIds: string[];
}

export function generateEnhancedBureauLetters(
  params: EnhancedLetterGenerationParams
): GeneratedLetter[] {
  const { report, issues, aiExplanations, userInfo, bureauFilter } = params;

  const consumer: ConsumerContact = {
    name: `${userInfo.firstName} ${userInfo.lastName}`,
    addressLine1: userInfo.address,
    city: userInfo.city,
    state: userInfo.state,
    postalCode: userInfo.zip,
  };

  const bureaus = bureauFilter
    ? BUREAU_ADDRESSES.filter(b => bureauFilter.includes(b.bureau))
    : BUREAU_ADDRESSES;

  const disputeLetters = buildBureauDisputeLetters({
    report,
    issues,
    explanations: aiExplanations,
    consumer,
    bureaus,
  });

  return disputeLetters.map(letter => ({
    bureau: letter.bureau,
    subject: letter.subject,
    content: letter.body,
    affectedIssueIds: letter.relatedIssueIds,
  }));
}

export function generateEnhancedCollectorLetters(
  params: EnhancedLetterGenerationParams
): GeneratedLetter[] {
  const { report, issues, aiExplanations, userInfo } = params;

  const consumer: ConsumerContact = {
    name: `${userInfo.firstName} ${userInfo.lastName}`,
    addressLine1: userInfo.address,
    city: userInfo.city,
    state: userInfo.state,
    postalCode: userInfo.zip,
  };

  // Extract unique collectors from the report
  const collectorMap = new Map<string, CollectorContact>();
  
  report.bureaus.forEach(bureau => {
    bureau.collections.forEach(collection => {
      const key = collection.collectorName.trim().toLowerCase();
      if (!collectorMap.has(key)) {
        collectorMap.set(key, {
          collectorName: collection.collectorName,
          addressLines: ["[Collector Address - To Be Filled]"],
        });
      }
    });
  });

  const collectors = Array.from(collectorMap.values());

  if (collectors.length === 0) {
    return [];
  }

  const disputeLetters = buildCollectorDisputeLetters({
    report,
    issues,
    explanations: aiExplanations,
    consumer,
    collectors,
  });

  return disputeLetters.map(letter => ({
    collectorName: letter.collectorName,
    subject: letter.subject,
    content: letter.body,
    affectedIssueIds: letter.relatedIssueIds,
  }));
}

export async function generateAllDisputeLetters(
  params: EnhancedLetterGenerationParams
): Promise<{
  bureauLetters: GeneratedLetter[];
  collectorLetters: GeneratedLetter[];
}> {
  const bureauLetters = generateEnhancedBureauLetters(params);
  const collectorLetters = generateEnhancedCollectorLetters(params);

  return {
    bureauLetters,
    collectorLetters,
  };
}
