// import { generateDisputeLetter } from "./openai";
// import type { CreditReportViolation } from "./openai";

// Temporary type definition
export interface CreditReportViolation {
  accountName: string;
  accountNumber?: string;
  bureau: string;
  violationType: string;
  description: string;
  statute: string;
  severity: string;
}

export interface ClientInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dob: string;
  ssnLast4: string;
}

export class LetterGeneratorService {
  async generateDisputeLetterPDF(
    violations: CreditReportViolation[],
    bureau: string,
    clientInfo: ClientInfo
  ): Promise<{
    letterContent: string;
    pdfBuffer: Buffer;
  }> {
    try {
      // Generate letter content using AI (stubbed for now)
      const letterContent = `Date: ${new Date().toLocaleDateString()}

${clientInfo.name}
${clientInfo.address}
${clientInfo.city}, ${clientInfo.state} ${clientInfo.zip}

${bureau} Credit Bureau
[Bureau Address]

Re: Dispute of Inaccurate Credit Information

Dear Sir/Madam,

I am writing to formally dispute the following inaccurate information on my credit report:

${violations.map(v => `- ${v.accountName}: ${v.description}`).join('\n')}

Under the Fair Credit Reporting Act (FCRA), I request that you investigate and remove these inaccurate items from my credit report.

Sincerely,
${clientInfo.name}
DOB: ${clientInfo.dob}
SSN: ***-**-${clientInfo.ssnLast4}`;
      
      // Convert to PDF using basic HTML to PDF conversion
      // In a real implementation, you'd use WeasyPrint or similar
      const htmlContent = this.convertLetterToHTML(letterContent);
      const pdfBuffer = await this.htmlToPdf(htmlContent);
      
      return {
        letterContent,
        pdfBuffer,
      };
    } catch (error: any) {
      console.error("Error generating dispute letter PDF:", error);
      throw new Error("Failed to generate dispute letter PDF: " + (error?.message || "Unknown error"));
    }
  }

  private convertLetterToHTML(letterContent: string): string {
    // Convert plain text letter to formatted HTML
    const formattedContent = letterContent
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
      
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: 'Times New Roman', serif;
                font-size: 12pt;
                line-height: 1.5;
                margin: 1in;
                color: #000;
            }
            .header {
                margin-bottom: 20px;
            }
            .date {
                margin-bottom: 20px;
            }
            .signature-line {
                margin-top: 40px;
                border-top: 1px solid #000;
                width: 200px;
                padding-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="letter-content">
            <p>${formattedContent}</p>
        </div>
    </body>
    </html>
    `;
  }

  private async htmlToPdf(htmlContent: string): Promise<Buffer> {
    // This is a simplified PDF generation
    // In a real implementation, you'd use WeasyPrint, Puppeteer, or similar
    try {
      // For now, return a simple buffer representing PDF content
      // You would implement actual PDF generation here using:
      // - WeasyPrint for Python-style HTML to PDF
      // - Puppeteer for browser-based PDF generation
      // - jsPDF for client-side PDF generation
      
      const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(${htmlContent.replace(/<[^>]*>/g, '').substring(0, 100)}...) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
398
%%EOF`);

      return pdfContent;
    } catch (error) {
      console.error("Error converting HTML to PDF:", error);
      throw new Error("Failed to convert HTML to PDF");
    }
  }

  async generateCFPBPacketPDF(
    complaintText: string,
    caseLawCitations: string[],
    supportingDocs: string[]
  ): Promise<Buffer> {
    try {
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>CFPB Complaint Packet</title>
          <style>
              body { font-family: 'Times New Roman', serif; margin: 1in; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .citations { margin-top: 20px; }
              .citation { margin-bottom: 10px; padding-left: 20px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>CONSUMER FINANCIAL PROTECTION BUREAU</h1>
              <h2>FORMAL COMPLAINT PACKET</h2>
          </div>
          
          <div class="section">
              <h3>COMPLAINT NARRATIVE</h3>
              <p>${complaintText}</p>
          </div>
          
          <div class="section citations">
              <h3>RELEVANT CASE LAW CITATIONS</h3>
              ${caseLawCitations.map(citation => `<div class="citation">• ${citation}</div>`).join('')}
          </div>
          
          <div class="section">
              <h3>SUPPORTING DOCUMENTATION</h3>
              ${supportingDocs.map(doc => `<div>• ${doc}</div>`).join('')}
          </div>
      </body>
      </html>
      `;

      return await this.htmlToPdf(htmlContent);
    } catch (error) {
      console.error("Error generating CFPB packet PDF:", error);
      throw new Error("Failed to generate CFPB packet PDF");
    }
  }
}

export const letterGeneratorService = new LetterGeneratorService();
