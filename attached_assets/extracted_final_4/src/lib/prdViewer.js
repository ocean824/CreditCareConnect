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

  const createContent = {
    upload: () => {
      const h3 = document.createElement('h3');
      h3.textContent = '📤 Document Upload';
      const ul = document.createElement('ul');
      ['Allow PDF, DOCX, PNG uploads', 'Show upload progress and validate formats', 'Simulate OCR summary generation'].forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      return [h3, ul];
    },
    ai: () => {
      const h3 = document.createElement('h3');
      h3.textContent = '🧠 AI Summary (Simulated)';
      const ul = document.createElement('ul');
      ['Fake AI response to uploaded content', 'Response should be timed for realism', 'Example: "Detected invoice dated Oct 2023..."'].forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      return [h3, ul];
    },
    click2mail: () => {
      const h3 = document.createElement('h3');
      h3.textContent = '📮 Click2Mail Toggle';
      const ul = document.createElement('ul');
      ['User selects whether to send document physically', 'Conditional logic paths should be simulated', 'Example: Skip download if Click2Mail is on'].forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.appendChild(li);
      });
      return [h3, ul];
    }
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
      // Safe DOM manipulation: clear and rebuild content
      contentArea.textContent = '';
      const elements = createContent[tab.dataset.tab]();
      elements.forEach(el => contentArea.appendChild(el));
    };
  });

  tabs[0].click(); // Default to first tab
}