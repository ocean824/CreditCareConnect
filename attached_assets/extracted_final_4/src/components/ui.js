export function createUI(root) {
  root.innerHTML = `
    <h1>📄 CreditCareConnect: Enhanced UI</h1>
    <div style="margin: 20px 0;">
      <label>
        <input type="checkbox" id="click2mailToggle" />
        Enable Click2Mail Integration
      </label>
    </div>
    <div>
      <input type="file" id="docUpload" />
      <button onclick="simulateUpload()">Upload & Summarize</button>
    </div>
    <div id="resultArea" style="margin-top: 20px; background: #fff; padding: 20px; border-radius: 10px;"></div>
    <div style="position: fixed; bottom: 10px; right: 10px;">
      <button onclick="alert('PRD: Upload flow with AI summary, click2mail toggle')">📘 PRD</button>
    </div>
  `;
}

window.simulateUpload = () => {
  const result = document.getElementById('resultArea');
  result.innerHTML = '<p>📤 Uploading...</p>';
  setTimeout(() => {
    result.innerHTML = `
      <p>✅ Document scanned.</p>
      <p><strong>Summary:</strong> This is a placeholder AI summary of your document.</p>
    `;
  }, 2000);
};