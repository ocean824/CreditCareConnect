import { createUI } from './components/ui.js';

window.addEventListener('DOMContentLoaded', () => {
  createUI(document.getElementById('app'));
});
import { renderPRDViewer } from './lib/prdViewer.js';
renderPRDViewer(document.body);
import { renderPrintPreview } from './lib/printPreview.js';
import { renderDocHistoryPanel, addToHistory } from './lib/docHistory.js';

renderDocHistoryPanel(document.body);

window.simulateUpload = () => {
  const result = document.getElementById('resultArea');
  const fileInput = document.getElementById('docUpload');
  const fileName = fileInput?.files?.[0]?.name || "user-upload.pdf";
  addToHistory(fileName);

  result.innerHTML = '<p>📤 Uploading...</p>';
  setTimeout(() => {
    result.innerHTML = `
      <p>✅ Document scanned.</p>
      <p><strong>Summary:</strong> This is a placeholder AI summary of your document.</p>
      <button onclick="renderPrintPreview('${fileName}')">🖨️ Preview Mail</button>
    `;
  }, 2000);
};
