import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
} from "docx";
import * as fs from "fs";
import * as path from "path";

interface UserInfo {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  email?: string;
}

interface ViolationSummary {
  accountName: string;
  accountNumber?: string;
  description: string;
  statute: string;
}

interface DisputeLetterParams {
  userInfo: UserInfo;
  bureau: "EQUIFAX" | "TRANSUNION" | "EXPERIAN";
  violations: ViolationSummary[];
  round: 1 | 2 | 3;
  letterContent: string;
}

const BUREAU_ADDRESSES: Record<string, { name: string; address: string; cityStateZip: string }> = {
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address: "P.O. Box 740256",
    cityStateZip: "Atlanta, GA 30374",
  },
  TRANSUNION: {
    name: "TransUnion LLC",
    address: "P.O. Box 2000",
    cityStateZip: "Chester, PA 19016",
  },
  EXPERIAN: {
    name: "Experian",
    address: "P.O. Box 4500",
    cityStateZip: "Allen, TX 75013",
  },
};

export async function generateDisputeLetterDocx(params: DisputeLetterParams): Promise<Buffer> {
  const { userInfo, bureau, violations, round, letterContent } = params;
  const bureauAddress = BUREAU_ADDRESSES[bureau];
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const roundTitles: Record<number, string> = {
    1: "Initial Dispute Letter",
    2: "Follow-Up Dispute Letter - Intent to Pursue Legal Action",
    3: "Final Notice - CFPB Complaint Pending",
  };

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({ text: userInfo.name, bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: userInfo.addressLine1, size: 22 })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${userInfo.city}, ${userInfo.state} ${userInfo.zip}`,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: userInfo.email || "", size: 22 })],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [new TextRun({ text: currentDate, size: 22 })],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [
              new TextRun({ text: bureauAddress.name, bold: true, size: 22 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: bureauAddress.address, size: 22 })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: bureauAddress.cityStateZip, size: 22 }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: roundTitles[round] || "Dispute Letter",
                bold: true,
                size: 28,
                underline: {},
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [
              new TextRun({
                text: `RE: Dispute of Inaccurate Information - ${bureau}`,
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [new TextRun({ text: "To Whom It May Concern:", size: 22 })],
          }),
          new Paragraph({ children: [] }),
          ...letterContent.split("\n").map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 22 })],
                spacing: { after: 100 },
              })
          ),
          new Paragraph({ children: [] }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: "DISPUTED ACCOUNTS:",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          ...violations.flatMap((v, idx) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${idx + 1}. ${v.accountName}`,
                  bold: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `Account Number: ${v.accountNumber || "Not Available"}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `Violation: ${v.description}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `Legal Basis: ${v.statute}`,
                  size: 22,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({ children: [] }),
          ]),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "I demand that you conduct a thorough investigation of the above-listed items and provide me with the results within 30 days as required by law. Please send verification of the disputed items, including the original creditor's signature on any application.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Failure to respond within 30 days will result in a formal complaint to the Consumer Financial Protection Bureau (CFPB), the Federal Trade Commission (FTC), and my state's Attorney General.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [new TextRun({ text: "Sincerely,", size: 22 })],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [
              new TextRun({ text: "________________________", size: 22 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: userInfo.name, size: 22 })],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

export async function saveDisputeLetterDocx(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads", "letters");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `uploads/letters/${filename}`;
}
