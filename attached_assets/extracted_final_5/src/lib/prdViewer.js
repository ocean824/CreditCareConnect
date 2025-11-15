export function renderPRDViewer(container) {
  container.innerHTML = `
    <div style="position:fixed;bottom:10px;left:10px;z-index:999;">
      <button id="togglePRD" style="padding:8px 16px;border-radius:8px;background:#4f46e5;color:white;border:none;">
        📘 View PRDs
      </button>
    </div>
    <div id="prdPanel" style="position:fixed;bottom:60px;left:10px;width:350px;height:400px;
                              background:white;border-radius:12px;box-shadow:0 0 10px rgba(0,0,0,0.2);
                              overflow:hidden;display:none;flex-direction:column;">
      <div style="display:flex; border-bottom:1px solid #ddd;">
        <button class="tab" data-tab="upload" style="flex:1;padding:10px;border:none;background:#f3f4f6;">Upload</button>
        <button class="tab" data-tab="ai" style="flex:1;padding:10px;border:none;background:#f3f4f6;">AI Summary</button>
        <button class="tab" data-tab="click2mail" style="flex:1;padding:10px;border:none;background:#f3f4f6;">Click2Mail</button>
      </div>
      <div id="prdContent" style="padding:1rem;overflow-y:auto;flex:1;"></div>
    </div>
  `;

  const content = {
    upload: \`
      <h3>📤 Document Upload</h3>
      <ul>
        <li>Allow PDF, DOCX, PNG uploads</li>
        <li>Show upload progress and validate formats</li>
        <li>Simulate OCR summary generation</li>
      </ul>
    \`,
    ai: \`
      <h3>🧠 AI Summary (Simulated)</h3>
      <ul>
        <li>Fake AI response to uploaded content</li>
        <li>Response should be timed for realism</li>
        <li>Example: "Detected invoice dated Oct 2023..."</li>
      </ul>
    \`,
    click2mail: \`
      <h3>📮 Click2Mail Toggle</h3>
      <ul>
        <li>User selects whether to send document physically</li>
        <li>Conditional logic paths should be simulated</li>
        <li>Example: Skip download if Click2Mail is on</li>
      </ul>
    \`
  };

  document.getElementById("togglePRD").onclick = () => {
    const panel = document.getElementById("prdPanel");
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
  };

  const tabs = document.querySelectorAll(".tab");
  const contentArea = document.getElementById("prdContent");
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.style.background = "#f3f4f6");
      tab.style.background = "#e0e7ff";
      // Safe DOM manipulation: clear and append parsed content
      contentArea.textContent = '';
      const template = document.createElement('template');
      template.innerHTML = content[tab.dataset.tab];
      contentArea.appendChild(template.content);
    };
  });

  tabs[0].click(); // Default to first tab
}