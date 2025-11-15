import { h, render } from "preact";
import { useLocation, Router, Route, Link } from "wouter/preact";
import { useEffect } from "preact/hooks";
import { renderDashboard, updateDashboard } from './lib/dashboard.js';
import { createUI } from './components/ui.js';
import { renderDocHistoryPanel, addToHistory } from './lib/docHistory.js';
import { renderPrintPreview } from './lib/printPreview.js';
import { renderPRDViewer } from './lib/prdViewer.js';

let uploadCount = 0;
let mailCount = 0;

function App() {
  useEffect(() => {
    renderDocHistoryPanel(document.body);
    renderPRDViewer(document.body);
  }, []);

  return (
    <Router>
      <nav style="padding:1rem;background:#f3f4f6;display:flex;gap:1rem;">
        <Link href="/"><button>🏠 Dashboard</button></Link>
        <Link href="/upload"><button>📤 Upload</button></Link>
        <Link href="/settings"><button>⚙️ Settings</button></Link>
      </nav>

      <Route path="/">
        <div id="dashboardRoot"></div>
      </Route>

      <Route path="/upload">
        <div id="uploadRoot"></div>
      </Route>

      <Route path="/settings">
        <div style="padding:2rem;">
          <h2>⚙️ Settings</h2>
          <p>Click2Mail toggle, themes, and simulation preferences could appear here.</p>
        </div>
      </Route>
    </Router>
  );
}

render(<App />, document.getElementById("app"));

window.mountPages = () => {
  renderDashboard(document.getElementById("dashboardRoot"));
  createUI(document.getElementById("uploadRoot"));
};

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

window.mountPages();