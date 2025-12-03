import OpenAI from "openai";
import { runAllRules } from "../rules/engine";
import type { CreditReport, BureauName } from "../models/creditReport";
import type { IssueFlag } from "../models/issues";
import type { AiIssueExplanation, DisputeAngle } from "../ai/disputeLetterGenerator";

// Use Replit AI Integrations if available, otherwise fall back to user's OpenAI API key
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const useReplitAI = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const userApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;

const openai = useReplitAI 
  ? new OpenAI({ 
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    })
  : (userApiKey ? new OpenAI({ apiKey: userApiKey }) : null);

const OPENAI_MODEL = useReplitAI ? "gpt-5" : (process.env.OPENAI_MODEL || "gpt-5");

if (!openai) {
  console.warn('⚠️  OpenAI not configured - AI explanations will be unavailable');
} else if (useReplitAI) {
  console.log('✅ Using Replit AI Integrations for credit analysis');
}

export interface AnalysisResult {
  issues: IssueFlag[];
  aiExplanations: AiIssueExplanation[];
  summary: string;
}

export async function analyzeWithRulesEngine(
  creditReport: CreditReport
): Promise<AnalysisResult> {
  console.log('📊 [ANALYSIS] Starting rules engine analysis');
  console.log(`📊 [DATA] Bureaus: ${creditReport.bureaus.length}`);
  
  // Log bureau details
  for (const bureau of creditReport.bureaus) {
    console.log(`  🏦 ${bureau.bureau}: ${bureau.tradelines.length} tradelines, ${bureau.collections.length} collections, ${bureau.publicRecords.length} public records`);
    for (const tl of bureau.tradelines.slice(0, 2)) {
      console.log(`    💳 Tradeline: ${tl.creditorName}, Status: ${tl.status}, Balance: ${tl.balance}, DOFD: ${tl.dateOfFirstDelinquency}`);
    }
    for (const col of bureau.collections.slice(0, 2)) {
      console.log(`    🚨 Collection: ${col.collectorName}, Balance: ${col.balance}, DOFD: ${col.dateOfFirstDelinquency}`);
    }
  }

  // Step 1: Run rules engine to detect violations
  console.log('🔬 [RULES] Running all rules...');
  const issues = runAllRules(creditReport);
  console.log(`✅ [RULES] Rules engine complete: ${issues.length} violations detected`);
  
  if (issues.length > 0) {
    console.log('📋 [VIOLATIONS] Issues found:');
    issues.forEach(issue => {
      console.log(`  - ${issue.ruleId} (${issue.category}): ${issue.descriptionMachine}`);
    });
  } else {
    console.log('⚠️  [VIOLATIONS] No violations detected - checking if data is empty...');
    const totalTradelines = creditReport.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
    const totalCollections = creditReport.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
    console.log(`  Total data points: ${totalTradelines} tradelines + ${totalCollections} collections`);
  }

  // Step 2: Generate AI explanations for each issue
  const aiExplanations = await generateAiExplanations(issues, creditReport);

  // Step 3: Generate summary
  const summary = generateSummary(issues, aiExplanations);

  return {
    issues,
    aiExplanations,
    summary,
  };
}

async function generateAiExplanations(
  issues: IssueFlag[],
  report: CreditReport
): Promise<AiIssueExplanation[]> {
  if (issues.length === 0) return [];
  
  // Gracefully degrade if OpenAI is not configured
  if (!openai) {
    console.warn('⚠️  OpenAI not configured - skipping AI explanations');
    return [];
  }

  try {
    const prompt = `
You are a credit repair expert. I have detected ${issues.length} potential FCRA/FDCPA/Metro2 violations in a credit report.
For each issue, provide:
1. A human-friendly summary (1-2 sentences)
2. Relevant statutes (FCRA Section X, FDCPA Section Y, etc.)
3. Dispute angle (INACCURATE, UNVERIFIABLE, OBSOLETE, MISLEADING, or HARDSHIP_MISREPORTING)
4. Recommended action
5. Priority (1=highest, 5=lowest)

Issues:
${issues.map((issue, idx) => `
${idx + 1}. Issue ID: ${issue.id}
   Rule: ${issue.ruleId}
   Category: ${issue.category}
   Description: ${issue.descriptionMachine}
   Affected Bureaus: ${issue.affectedBureaus?.join(', ') || 'Unknown'}
`).join('\n')}

Return a JSON array of explanations with this structure:
{
  "explanations": [
    {
      "issueId": "issue_id_here",
      "accountLabel": "Brief account label",
      "humanSummary": "Human-friendly explanation",
      "statutes": ["FCRA §1681e(b)", "Metro 2 Rule 123"],
      "disputeAngle": "INACCURATE",
      "recommendedAction": "Request deletion/correction/verification",
      "priority": 1
    }
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert credit repair analyst specializing in FCRA, FDCPA, and Metro2 compliance."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.explanations || [];
  } catch (error) {
    console.error("Error generating AI explanations:", error);
    // Return fallback explanations
    return issues.map(issue => ({
      issueId: issue.id,
      accountLabel: `${issue.affectedEntityType} Issue`,
      humanSummary: issue.descriptionMachine,
      statutes: issue.statutes || [],
      disputeAngle: "INACCURATE" as DisputeAngle,
      recommendedAction: "Request verification and correction",
      priority: 3,
    }));
  }
}

function generateSummary(issues: IssueFlag[], explanations: AiIssueExplanation[]): string {
  if (issues.length === 0) {
    return "No violations detected in this credit report.";
  }

  const highPriority = explanations.filter(e => e.priority <= 2).length;
  const bureaus = new Set<BureauName>();
  
  issues.forEach(issue => {
    issue.affectedBureaus?.forEach(b => bureaus.add(b));
  });

  return `Detected ${issues.length} potential violation(s) across ${bureaus.size} bureau(s). ${highPriority} high-priority issue(s) requiring immediate attention.`;
}

export function convertIssuesToViolations(issues: IssueFlag[], explanations: AiIssueExplanation[]) {
  const explanationMap = new Map(explanations.map(e => [e.issueId, e]));
  
  return issues.map(issue => {
    const explanation = explanationMap.get(issue.id);
    
    return {
      accountName: explanation?.accountLabel || issue.affectedEntityType,
      accountNumber: null,
      bureau: issue.affectedBureaus?.[0] || "EQUIFAX",
      violationType: issue.category,
      description: explanation?.humanSummary || issue.descriptionMachine,
      statute: issue.statutes?.join(", ") || "FCRA/FDCPA",
      severity: issue.severity,
    };
  });
}
