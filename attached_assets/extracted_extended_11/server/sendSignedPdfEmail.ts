import nodemailer from 'nodemailer';
import fs from 'fs';

export async function sendSignedPdfEmail(to: string, filePath: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const mailOptions = {
    from: '"CreditCareConnect" <noreply@creditcare.ai>',
    to,
    subject: '📄 Your Signed PDF Document',
    text: 'Attached is the signed document with digital signature and watermark.',
    attachments: [
      {
        filename: 'SignedDocument.pdf',
        content: fs.createReadStream(filePath)
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📬 Email sent:', info.messageId);
  return info;
}