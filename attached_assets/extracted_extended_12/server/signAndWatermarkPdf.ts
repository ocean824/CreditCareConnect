import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

export async function signAndWatermarkPdf(pdfPath: string, signaturePath: string, outputPath: string) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const signatureBytes = fs.readFileSync(signaturePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const signatureImage = await pdfDoc.embedPng(signatureBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // Draw Signature
  page.drawImage(signatureImage, {
    x: width - 160,
    y: 50,
    width: 100,
    height: 40,
  });

  // Add Watermark
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('SIGNED & CERTIFIED', {
    x: 50,
    y: height - 50,
    size: 18,
    font,
    color: rgb(0.95, 0.1, 0.1),
    opacity: 0.5,
  });

  const finalPdf = await pdfDoc.save();
  fs.writeFileSync(outputPath, finalPdf);
  return outputPath;
}