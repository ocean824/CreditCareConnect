import OpenAI from "openai";

// Using GPT-5.1 Chat (gpt-5.1-chat-latest) - Latest advanced reasoning model for credit analysis
// Provides superior accuracy for credit report parsing and violation detection with advanced reasoning
// Configurable via OPENAI_MODEL environment variable
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY 
});

// Get the model from environment or default to gpt-5.1-chat-latest
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.1-chat-latest";

export interface CreditReportViolation {
  accountName: string;
  accountNumber?: string;
  violationType: string;
  description: string;
  statute: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  bureau: string;
}

export async function analyzeCreditReport(reportText: string, bureau?: string): Promise<{
  violations: CreditReportViolation[];
  summary: string;
}> {
  try {
    const bureauInstruction = bureau === "TRI-MERGE" 
      ? `
      This is a TRI-MERGE credit report containing data from all three bureaus (Equifax, TransUnion, Experian).
      For each violation, identify which specific bureau (EQUIFAX, TRANSUNION, or EXPERIAN) the violation appears on.
      Each violation should be tagged with the specific bureau name, NOT "TRI-MERGE".
      `
      : bureau 
      ? `This report is from ${bureau}. All violations should be tagged with bureau: "${bureau}".`
      : `Identify which bureau each violation appears on (EQUIFAX, TRANSUNION, or EXPERIAN).`;

    const prompt = `
    You are a credit repair expert analyzing credit reports for Metro2 and FCRA violations. 
    Analyze the following credit report text and identify all violations.
    
    ${bureauInstruction}
    
    Look for these common violations:
    - Missing Date of First Delinquency (DOFD)
    - Charge-off accounts showing balance
    - Unauthorized hard inquiries
    - Duplicate account reporting
    - Inaccurate account status
    - Missing original creditor information
    - Accounts beyond statute of limitations
    - Inaccurate payment history
    
    For each violation, provide:
    - Account name and number (if available)
    - Type of violation
    - Description of the issue
    - Relevant FCRA statute (e.g., "FCRA §1681e(b)")
    - Severity level (HIGH, MEDIUM, LOW)
    - Bureau where violation appears (must be EQUIFAX, TRANSUNION, or EXPERIAN)
    
    Return response in JSON format with violations array and summary.
    
    Credit Report Text:
    ${reportText}
    `;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert credit repair analyst. Analyze credit reports for FCRA and Metro2 violations with legal precision."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      violations: result.violations || [],
      summary: result.summary || "Credit report analysis completed."
    };
  } catch (error: any) {
    console.error("Error analyzing credit report:", error);
    throw new Error("Failed to analyze credit report: " + (error?.message || "Unknown error"));
  }
}

export async function generateDisputeLetter(
  violations: CreditReportViolation[],
  bureau: string,
  clientInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dob: string;
    ssnLast4: string;
  }
): Promise<string> {
  try {
    const bureauAddresses = {
      EQUIFAX: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374",
      TRANSUNION: "TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016",
      EXPERIAN: "Experian\nP.O. Box 4500\nAllen, TX 75013"
    };

    const prompt = `
    Generate a professional, legally compliant dispute letter for ${bureau} based on the provided violations.
    Use the FCRA statutes and violation details provided.
    
    Client Information:
    ${clientInfo.name}
    ${clientInfo.address}
    ${clientInfo.city}, ${clientInfo.state} ${clientInfo.zip}
    DOB: ${clientInfo.dob}
    SSN: XXX-XX-${clientInfo.ssnLast4}
    
    Bureau Address:
    ${bureauAddresses[bureau as keyof typeof bureauAddresses] || bureauAddresses.EQUIFAX}
    
    Violations to dispute:
    ${violations.map((v, i) => `${i + 1}. ${v.accountName}: ${v.description} (${v.statute})`).join('\n')}
    
    The letter should:
    - Be professional and legally precise
    - Reference specific FCRA statutes
    - Demand proper reinvestigation
    - Include all required legal language
    - Request written confirmation of results
    - Set 30-day response deadline
    
    Format as a complete business letter with proper headers, date, and signature line.
    `;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a legal expert specializing in credit repair and FCRA compliance. Generate professional dispute letters."
        },
        {
          role: "user",
          content: prompt
        }
      ],
    });

    return response.choices[0].message.content || "";
  } catch (error: any) {
    console.error("Error generating dispute letter:", error);
    throw new Error("Failed to generate dispute letter: " + (error?.message || "Unknown error"));
  }
}

export async function chatWithAI(
  message: string,
  conversationHistory: any[],
  userPlan: string,
  userViolations?: CreditReportViolation[]
): Promise<string> {
  try {
    const systemPrompt = `
    You are a credit repair AI assistant for Personal Credit Pros. 
    User's current plan: ${userPlan}
    
    ${userPlan === "DIY" ? 
      "This user is on the DIY plan. Help them understand their dispute letters and guide them through manual mailing processes." :
      "This user is on the Done-For-You plan. You can help with automated processes, CRM integration, and advanced features."
    }
    
    ${userViolations ? `User's detected violations: ${JSON.stringify(userViolations)}` : ""}
    
    Be helpful, professional, and knowledgeable about credit repair, FCRA, and dispute processes.
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages as any,
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error: any) {
    console.error("Error in AI chat:", error);
    throw new Error("Failed to process chat message: " + (error?.message || "Unknown error"));
  }
}

export async function generateCFPBComplaint(
  violations: CreditReportViolation[],
  clientInfo: any,
  disputeHistory: any[]
): Promise<{
  complaintText: string;
  caseLawCitations: string[];
}> {
  try {
    const prompt = `
    Generate a comprehensive CFPB complaint based on the following credit repair violations and dispute history.
    
    Client: ${clientInfo.name}
    Violations: ${JSON.stringify(violations)}
    Dispute History: ${JSON.stringify(disputeHistory)}
    
    The complaint should include:
    - Detailed narrative of violations
    - Timeline of dispute attempts
    - FCRA violations and statutes
    - Request for investigation and resolution
    - Relevant case law citations
    
    Return JSON with complaintText and caseLawCitations array.
    `;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a legal expert generating CFPB complaints for credit repair violations. Include relevant case law and legal precedents."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      complaintText: result.complaintText || "",
      caseLawCitations: result.caseLawCitations || []
    };
  } catch (error: any) {
    console.error("Error generating CFPB complaint:", error);
    throw new Error("Failed to generate CFPB complaint: " + (error?.message || "Unknown error"));
  }
}
