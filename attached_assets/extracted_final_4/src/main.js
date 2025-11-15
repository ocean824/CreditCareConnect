import { renderDashboard, updateDashboard } from './lib/dashboard.js';

let uploadCount = 0;
let mailCount = 0;

function mountAppUI() {
  renderDashboard(document.getElementById('app'));
  createUI(document.getElementById('app'));
  renderPRDViewer(document.body);
  renderDocHistoryPanel(document.body);
}

window.simulateUpload = () => {
  const result = document.getElementById('resultArea');
  const fileInput = document.getElementById('docUpload');
  const fileName = fileInput?.files?.[0]?.name || "user-upload.pdf";
  addToHistory(fileName);
  uploadCount += 1;
  updateDashboard(uploadCount, mailCount);

  result.innerHTML = '<p>📤 Uploading...</p>';
  setTimeout(() => {
    result.innerHTML = `
      <p>✅ Document scanned.</p>
      <p><strong>Summary:</strong> This is a placeholder AI summary of your document.</p>
      <button onclick="mailCount += 1; updateDashboard(uploadCount, mailCount); renderPrintPreview('${fileName}')">
        🖨️ Preview Mail
      </button>
    `;
  }, 2000);
};

mountAppUI();