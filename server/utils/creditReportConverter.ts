import type { CreditReport, BureauReport, Tradeline, BureauName } from "../models/creditReport";

/**
 * Converts a simplified parsed credit report to the comprehensive CreditReport format
 * required by the rules engine.
 * 
 * This is a basic converter that creates a minimal valid credit report structure.
 * In a production implementation, you would parse actual PDF/HTML credit reports
 * to extract all the detailed information.
 */
export function convertToCreditReport(params: {
  bureau: string;
  reportText?: string;
  userId: string;
  fileName: string;
}): CreditReport {
  const { bureau, reportText, userId, fileName } = params;

  // Map bureau string to BureauName type
  const bureauName: BureauName = mapBureauName(bureau);

  // Create a basic credit report structure
  // In production, this would parse the actual report content
  const bureauReport: BureauReport = {
    bureau: bureauName,
    reportId: fileName,
    tradelines: extractTradelines(reportText || ""),
    collections: extractCollections(reportText || ""),
    publicRecords: [],
    inquiries: [],
  };

  const creditReport: CreditReport = {
    pulledAt: new Date().toISOString(),
    provider: "Upload",
    consumer: {
      fullName: "",  // Will be extracted by AI parser
      addresses: [],
    },
    bureaus: [bureauReport],
  };

  return creditReport;
}

function mapBureauName(bureau: string): BureauName {
  const normalized = bureau.toUpperCase();
  
  if (normalized.includes("EQUIFAX")) return "Equifax";
  if (normalized.includes("TRANSUNION")) return "TransUnion";
  if (normalized.includes("EXPERIAN")) return "Experian";
  
  return "Other";
}

/**
 * Extract tradelines from report text
 * This is a placeholder - in production, use proper PDF parsing
 */
function extractTradelines(reportText: string): Tradeline[] {
  // TODO: Implement actual parsing logic
  // For now, return empty array or sample data
  return [];
}

/**
 * Extract collections from report text
 * This is a placeholder - in production, use proper PDF parsing
 */
function extractCollections(reportText: string) {
  // TODO: Implement actual parsing logic
  return [];
}

/**
 * Converts a TRI-MERGE report to multiple bureau reports
 */
export function convertTriMergeToCreditReport(params: {
  reportText: string;
  userId: string;
  fileName: string;
}): CreditReport {
  // Parse TRI-MERGE and create separate bureau reports
  // For now, create placeholder structure with all three bureaus
  
  const creditReport: CreditReport = {
    pulledAt: new Date().toISOString(),
    provider: "TRI-MERGE Upload",
    consumer: {
      fullName: "",  // Will be extracted by AI parser
      addresses: [],
    },
    bureaus: [
      {
        bureau: "Equifax",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
      {
        bureau: "TransUnion",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
      {
        bureau: "Experian",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
    ],
  };

  return creditReport;
}
