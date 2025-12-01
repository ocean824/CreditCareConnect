export function renderLetterHtml(body: string, subject: string): string {
  const escapedBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subject.replace(/"/g, "&quot;")}</title>
  <style>
    body {
      font-family: "Times New Roman", Georgia, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      padding: 1in;
      margin: 0;
    }
    .page {
      max-width: 8.5in;
      margin: 0 auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="page">${escapedBody}</div>
</body>
</html>`;
}
