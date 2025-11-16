import OpenAI from "openai";
import { runAllRules } from "../rules/engine";
import type { CreditReport, BureauName } from "../models/creditReport";
import type { IssueFlag } from "../models/issues";
import type { AiIssueExplanation, DisputeAngle } from "../ai/disputeLetterGenerator";

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

if (!apiKey) {
  console.warn('⚠️  OpenAI API key not configured - AI explanations will be unavailable');
}

export interface AnalysisResult {
  issues: IssueFlag[];
  aiExplanations: AiIssueExplanation[];
  summary: string;
}

export async function analyzeWithRulesEngine(
  creditReport: CreditReport
): Promise<AnalysisResult> {
  // Step 1: Run rules engine to detect violations
  const issues = runAllRules(creditReport);

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
      model: "gpt-4o",  // Using GPT-4 Turbo (latest stable model)
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
