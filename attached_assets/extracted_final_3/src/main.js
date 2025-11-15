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

  result.textContent = '';
  const uploadingMsg = document.createElement('p');
  uploadingMsg.textContent = '📤 Uploading...';
  result.appendChild(uploadingMsg);
  
  setTimeout(() => {
    result.textContent = '';
    
    const successMsg = document.createElement('p');
    successMsg.textContent = '✅ Document scanned.';
    result.appendChild(successMsg);
    
    const summaryMsg = document.createElement('p');
    const summaryStrong = document.createElement('strong');
    summaryStrong.textContent = 'Summary:';
    summaryMsg.appendChild(summaryStrong);
    summaryMsg.appendChild(document.createTextNode(' This is a placeholder AI summary of your document.'));
    result.appendChild(summaryMsg);
    
    const previewBtn = document.createElement('button');
    previewBtn.textContent = '🖨️ Preview Mail';
    previewBtn.addEventListener('click', () => {
      mailCount += 1;
      updateDashboard(uploadCount, mailCount);
      renderPrintPreview(fileName);
    });
    result.appendChild(previewBtn);
  }, 2000);
};

mountAppUI();