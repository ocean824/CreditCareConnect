import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

export async function renderSignatureOnPdf(pdfPath: string, signaturePath: string, outputPath: string) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const signatureBytes = fs.readFileSync(signaturePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pngImage = await pdfDoc.embedPng(signatureBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  page.drawImage(pngImage, {
    x: width - 160,
    y: 50,
    width: 100,
    height: 40,
  });

  const modifiedPdf = await pdfDoc.save();
  fs.writeFileSync(outputPath, modifiedPdf);
  console.log(`✅ PDF saved with signature: ${outputPath}`);
}