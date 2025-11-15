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

  result.textContent = '📤 Uploading...';
  setTimeout(() => {
    result.innerHTML = '';
    
    const p1 = document.createElement('p');
    p1.textContent = '✅ Document scanned.';
    
    const p2 = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Summary:';
    p2.appendChild(strong);
    p2.appendChild(document.createTextNode(' This is a placeholder AI summary of your document.'));
    
    const button = document.createElement('button');
    button.textContent = '🖨️ Preview Mail';
    button.addEventListener('click', () => {
      mailCount += 1;
      updateDashboard(uploadCount, mailCount);
      renderPrintPreview(fileName);
    });
    
    result.appendChild(p1);
    result.appendChild(p2);
    result.appendChild(button);
  }, 2000);
};

mountAppUI();