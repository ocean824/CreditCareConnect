export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  try {
    const puppeteer = await import("puppeteer");

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm"
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
  }
}
