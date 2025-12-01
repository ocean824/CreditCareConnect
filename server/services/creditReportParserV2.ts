import OpenAI from "openai";
import {
  TriMergeCreditReport,
  BureauCode,
  BureauSnapshot,
  Tradeline,
  CollectionAccount,
  PublicRecord,
  Inquiry,
  AccountStatus,
  TradelineType,
  CollectionStatus,
} from "../models/credit";
import { nanoid } from "nanoid";

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export interface ParseCreditReportParams {
  rawText: string;
  bureauHint: BureauCode;
  provider?: string;
  userId: string;
  existingReportId?: string;
}

const SYSTEM_PROMPT = `You are a strict JSON-only parser for consumer credit reports, especially IdentityIQ tri-merge PDFs.

Your job:
- Read raw text of a credit report (often IdentityIQ tri-merge including Experian, Equifax, and TransUnion).
- Normalize it into a single JSON object with the exact shape of TriMergeCreditReport.
- When parsing tri-merge reports, you MUST:
  - Detect which tradelines/collections appear on which bureaus
  - Link the same underlying debt across bureaus using creditor name, account number, and similar balances
  - Populate per-bureau snapshots for tradelines and collections
- When parsing single-bureau reports, use the same structure with only that one bureau

OUTPUT RULES (CRITICAL):
- Output MUST be a single JSON object ONLY. No markdown. No prose. No explanations.
- All money amounts should be numeric (no '$' or commas)
- If a field value is unknown, use null or empty array
- All dates must be ISO-8601 format (YYYY-MM-DD)

Return this exact JSON structure:
{
  "id": "string",
  "userId": "string",
  "meta": {
    "id": "string",
    "provider": "string",
    "reportDate": "YYYY-MM-DD",
    "bureausIncluded": ["EXPERIAN", "EQUIFAX", "TRANSUNION"]
  },
  "tradelines": [
    {
      "id": "string",
      "creditorName": "string",
      "accountNumberLast4": "string",
      "type": "MORTGAGE|AUTO|CREDIT_CARD|PERSONAL_LOAN|HELOC|STUDENT_LOAN|OTHER",
      "status": "OPEN|CLOSED|CURRENT|LATE_30|LATE_60|LATE_90|LATE_120|LATE_150_PLUS|COLLECTION|CHARGE_OFF|FORECLOSURE|REPOSSESSION|UNKNOWN",
      "balance": 1234.56,
      "pastDue": 123.45,
      "bureaus": ["EXPERIAN", "EQUIFAX"],
      "bureauSnapshots": [
        {
          "bureau": "EXPERIAN",
          "status": "CHARGE_OFF|LATE_120|CURRENT",
          "balance": 1234.56,
          "pastDue": 0
        }
      ],
      "remarks": ["string"]
    }
  ],
  "collections": [
    {
      "id": "string",
      "collectorName": "string",
      "originalCreditorName": "string|null",
      "status": "OPEN_COLLECTION|PAID_COLLECTION|SETTLED|UNKNOWN",
      "balance": 1572.00,
      "bureaus": ["TRANSUNION", "EXPERIAN"],
      "bureauSnapshots": [
        {
          "bureau": "TRANSUNION",
          "status": "OPEN_COLLECTION",
          "balance": 1572.00,
          "pastDue": 0
        }
      ],
      "remarks": []
    }
  ],
  "publicRecords": [],
  "inquiries": []
}

TRI-MERGE LINKING RULES:
- IdentityIQ tri-merge reports list accounts separately under "Experian", "Equifax", and "TransUnion" sections
- When the SAME underlying debt appears across multiple bureaus (matched by creditor name, account number, similar balance):
  - Merge into ONE tradeline/collection in the JSON
  - Use creditor name, account number last 4, and similar balances to determine matches
  - Example: "GM FINANCIAL" auto showing $0 on TU but $11,265 on EX/EQ = ONE tradeline with 3 bureauSnapshots
- tradlines[].bureaus = list of bureaus where this appears
- tradelines[].bureauSnapshots = array with one entry per bureau

SINGLE-BUREAU CASE:
- If only one bureau is present, still use the same structure
- meta.bureausIncluded contains only that bureau
- Each tradeline has bureaus: ["EXPERIAN"] with a single bureauSnapshot`;

function buildUserPrompt(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  existingReportId?: string
): string {
  const snippet = rawText.length > 16000 ? rawText.slice(0, 16000) : rawText;

  return `Provider: ${provider}
Bureau hint: ${bureauHint}
User ID: ${userId}
Report ID: ${existingReportId || nanoid()}

If bureauHint == "TRI":
- This is a tri-merge report with Experian, Equifax, and TransUnion sections
- IdentityIQ often labels sections clearly with headers
- MUST detect the three bureau sections and match accounts across them
- Populate bureauSnapshots for each tradeline/collection
- Set meta.bureausIncluded to list of bureaus actually present

If bureauHint is a single bureau:
- Only that bureau's data is present
- meta.bureausIncluded: [that bureau]
- All items have bureaus/bureauSnapshots for only that one bureau

RAW REPORT TEXT (POSSIBLY TRUNCATED):

"""${snippet}"""

Return ONLY a single JSON object matching TriMergeCreditReport. No explanations.`;
}

export async function parseCreditReportWithAiOnly(params: ParseCreditReportParams): Promise<TriMergeCreditReport> {
  const { rawText, bureauHint, provider = "IDENTITYIQ", userId, existingReportId } = params;

  if (!openai) {
    console.warn("⚠️ OpenAI not configured - using fallback parser");
    return buildFallbackReport(userId, bureauHint, existingReportId);
  }

  try {
    const reportId = existingReportId || nanoid();
    const userPrompt = buildUserPrompt(rawText, bureauHint, provider, userId, reportId);

    console.log(`🤖 Parsing ${bureauHint} report with AI...`);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and normalize the parsed report
    const report: TriMergeCreditReport = {
      id: parsed.id || reportId,
      userId,
      meta: {
        id: parsed.meta?.id || reportId,
        provider: parsed.meta?.provider || provider,
        reportDate: parsed.meta?.reportDate || new Date().toISOString().split("T")[0],
        bureausIncluded: parsed.meta?.bureausIncluded || [
          bureauHint === "TRI" ? "EXPERIAN" : bureauHint,
        ],
      },
      tradelines: (parsed.tradelines || []).map((tl: any) => ({
        id: tl.id || nanoid(),
        creditorName: tl.creditorName || "Unknown",
        accountNumberLast4: tl.accountNumberLast4,
        type: validateTradelineType(tl.type) || "OTHER",
        status: validateAccountStatus(tl.status) || "UNKNOWN",
        balance: tl.balance ?? null,
        pastDue: tl.pastDue ?? null,
        bureaus: tl.bureaus || [],
        bureauSnapshots: (tl.bureauSnapshots || []).map((bs: any) => ({
          bureau: bs.bureau as any,
          status: validateAccountStatus(bs.status) || "UNKNOWN",
          balance: bs.balance ?? null,
          pastDue: bs.pastDue ?? null,
        })),
        remarks: tl.remarks || [],
      })),
      collections: (parsed.collections || []).map((c: any) => ({
        id: c.id || nanoid(),
        collectorName: c.collectorName || "Unknown",
        originalCreditorName: c.originalCreditorName,
        status: validateCollectionStatus(c.status) || "UNKNOWN",
        balance: c.balance ?? null,
        bureaus: c.bureaus || [],
        bureauSnapshots: (c.bureauSnapshots || []).map((bs: any) => ({
          bureau: bs.bureau as any,
          status: validateAccountStatus(bs.status) || "UNKNOWN",
          balance: bs.balance ?? null,
          pastDue: bs.pastDue ?? null,
        })),
        remarks: c.remarks || [],
      })),
      publicRecords: (parsed.publicRecords || []).map((pr: any) => ({
        id: pr.id || nanoid(),
        type: pr.type || "OTHER",
        courtName: pr.courtName,
        amount: pr.amount ?? null,
        bureaus: pr.bureaus || [],
      })),
      inquiries: (parsed.inquiries || []).map((inq: any) => ({
        id: inq.id || nanoid(),
        bureau: inq.bureau as any,
        inquirerName: inq.inquirerName || "Unknown",
        date: inq.date || new Date().toISOString().split("T")[0],
        type: inq.type,
      })),
    };

    console.log(`✅ Parsed report: ${report.tradelines.length} tradelines, ${report.collections.length} collections`);
    return report;
  } catch (error: any) {
    console.error("❌ AI parsing failed:", error.message);
    return buildFallbackReport(userId, bureauHint, existingReportId);
  }
}

function buildFallbackReport(
  userId: string,
  bureauHint: BureauCode,
  existingReportId?: string
): TriMergeCreditReport {
  const reportId = existingReportId || nanoid();
  const bureaus =
    bureauHint === "TRI"
      ? ["EXPERIAN", "EQUIFAX", "TRANSUNION"]
      : [
          bureauHint === "EXPERIAN"
            ? "EXPERIAN"
            : bureauHint === "EQUIFAX"
              ? "EQUIFAX"
              : "TRANSUNION",
        ];

  return {
    id: reportId,
    userId,
    meta: {
      id: reportId,
      provider: "IDENTITYIQ",
      reportDate: new Date().toISOString().split("T")[0],
      bureausIncluded: bureaus as any,
    },
    tradelines: [],
    collections: [],
    publicRecords: [],
    inquiries: [],
  };
}

function validateTradelineType(type: any): TradelineType | null {
  if (!type) return null;
  const t = String(type).toUpperCase();
  if (["MORTGAGE", "AUTO", "CREDIT_CARD", "PERSONAL_LOAN", "HELOC", "STUDENT_LOAN", "OTHER"].includes(t))
    return t as TradelineType;
  return null;
}

function validateAccountStatus(status: any): AccountStatus | null {
  if (!status) return null;
  const s = String(status).toUpperCase();
  if (
    [
      "OPEN",
      "CLOSED",
      "CURRENT",
      "LATE_30",
      "LATE_60",
      "LATE_90",
      "LATE_120",
      "LATE_150_PLUS",
      "COLLECTION",
      "CHARGE_OFF",
      "FORECLOSURE",
      "REPOSSESSION",
      "UNKNOWN",
    ].includes(s)
  )
    return s as AccountStatus;
  return null;
}

function validateCollectionStatus(status: any): CollectionStatus | null {
  if (!status) return null;
  const s = String(status).toUpperCase();
  if (["OPEN_COLLECTION", "PAID_COLLECTION", "SETTLED", "UNKNOWN"].includes(s)) return s as CollectionStatus;
  return null;
}
