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
    result.innerHTML = '';
    
    const successMsg = document.createElement('p');
    successMsg.textContent = '✅ Document scanned.';
    result.appendChild(successMsg);
    
    const summary = document.createElement('p');
    const strongTag = document.createElement('strong');
    strongTag.textContent = 'Summary:';
    summary.appendChild(strongTag);
    summary.appendChild(document.createTextNode(' This is a placeholder AI summary of your document.'));
    result.appendChild(summary);
    
    const previewBtn = document.createElement('button');
    previewBtn.textContent = '🖨️ Preview Mail';
    previewBtn.addEventListener('click', () => renderPrintPreview(fileName));
    result.appendChild(previewBtn);
  }, 2000);
};
