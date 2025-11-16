import OpenAI from "openai";
import type { CreditReport, BureauName } from "../models/creditReport";

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function parseCreditReportText(
  reportText: string,
  bureau: string
): Promise<CreditReport> {
  if (!openai) {
    console.warn('⚠️  OpenAI not configured - using basic text parsing');
    return parseWithBasicLogic(reportText, bureau);
  }

  try {
    const prompt = `
You are a credit report parsing expert. Parse the following credit report text into a structured JSON format.

Bureau: ${bureau}

Extract the following information:
1. Consumer information (name, SSN last 4, DOB, addresses)
2. Tradelines (accounts) with all available fields:
   - Creditor name
   - Account type (CreditCard, Installment, Mortgage, Auto, StudentLoan, etc.)
   - Account number (partial or full)
   - Status (Open, Closed, ChargeOff, Collection, etc.)
   - Balance
   - Payment status
   - Credit limit / High credit
   - Opened date
   - Last updated date
   - Payment history
   - Date of first delinquency (if applicable)
3. Collections with:
   - Collector name
   - Original creditor
   - Balance
   - Status
   - Opened date
4. Public records (bankruptcies, judgments, liens)
5. Inquiries (hard and soft)

For TRI-MERGE reports, identify which bureau each account appears on (EQUIFAX, TRANSUNION, EXPERIAN).

Return a JSON object with this structure:
{
  "consumer": {
    "fullName": "string",
    "ssnLast4": "string",
    "dob": "YYYY-MM-DD",
    "addresses": [{"line1": "string", "city": "string", "state": "string", "postalCode": "string"}]
  },
  "bureaus": [
    {
      "bureau": "Equifax|TransUnion|Experian",
      "tradelines": [
        {
          "creditorName": "string",
          "type": "CreditCard|Installment|Mortgage|Auto|StudentLoan",
          "accountNumber": "string",
          "status": "Open|Closed|ChargeOff|Collection",
          "balance": number,
          "paymentStatus": "Current|Late30|Late60|Late90|ChargeOff",
          "creditLimit": number,
          "highCreditLimit": number,
          "openedDate": "YYYY-MM-DD",
          "lastUpdatedDate": "YYYY-MM-DD",
          "dateOfFirstDelinquency": "YYYY-MM-DD",
          "paymentHistory": "string (optional)"
        }
      ],
      "collections": [
        {
          "collectorName": "string",
          "originalCreditorName": "string",
          "balance": number,
          "status": "Open|Closed",
          "openedDate": "YYYY-MM-DD"
        }
      ],
      "publicRecords": [],
      "inquiries": [
        {
          "inquirerName": "string",
          "date": "YYYY-MM-DD",
          "type": "Hard|Soft"
        }
      ]
    }
  ]
}

Credit Report Text:
${reportText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert credit report parser. Extract all account details with precision. Return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for accuracy
    });

    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    
    // Ensure we have a valid credit report structure
    const creditReport: CreditReport = {
      pulledAt: new Date().toISOString(),
      provider: "Uploaded",
      consumer: parsed.consumer || {
        fullName: "Unknown Consumer",
        addresses: [{ line1: "", city: "", state: "", postalCode: "" }]
      },
      bureaus: Array.isArray(parsed.bureaus) && parsed.bureaus.length > 0 
        ? parsed.bureaus.map((b: any) => ({
            ...b,
            internalId: `${b.bureau}_${Date.now()}`
          }))
        : [{
            bureau: normalizeBureauName(bureau),
            tradelines: [],
            collections: [],
            publicRecords: [],
            inquiries: []
          }]
    };

    return creditReport;
  } catch (error: any) {
    console.error("Error parsing credit report with AI:", error);
    console.warn("Falling back to basic parsing");
    return parseWithBasicLogic(reportText, bureau);
  }
}

function normalizeBureauName(bureau: string): BureauName {
  const upper = bureau.toUpperCase();
  if (upper.includes("EQUIFAX")) return "Equifax";
  if (upper.includes("TRANSUNION") || upper.includes("TRANS UNION")) return "TransUnion";
  if (upper.includes("EXPERIAN")) return "Experian";
  return "Equifax"; // Default fallback
}

function parseWithBasicLogic(reportText: string, bureau: string): CreditReport {
  // Basic fallback parser (limited functionality)
  console.warn("Using basic parser - limited accuracy");
  
  return {
    pulledAt: new Date().toISOString(),
    provider: "Uploaded",
    consumer: {
      fullName: "Consumer Name (OCR parsing required)",
      addresses: [{ 
        line1: "Address not parsed", 
        city: "City", 
        state: "ST", 
        postalCode: "00000" 
      }]
    },
    bureaus: [{
      bureau: normalizeBureauName(bureau),
      tradelines: [],
      collections: [],
      publicRecords: [],
      inquiries: []
    }]
  };
}
