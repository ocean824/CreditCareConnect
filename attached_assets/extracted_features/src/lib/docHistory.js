export function renderDocHistoryPanel(container) {
  const panel = document.createElement("div");
  panel.innerHTML = \`
    <div style="position:fixed;top:10px;right:10px;z-index:900;">
      <button id="toggleHistory" style="padding:8px 16px;border-radius:8px;background:#059669;color:white;border:none;">
        📂 History
      </button>
    </div>
    <div id="historyPanel" style="position:fixed;top:60px;right:10px;width:280px;height:300px;background:white;
                                border-radius:12px;box-shadow:0 0 10px rgba(0,0,0,0.2);padding:1rem;display:none;overflow-y:auto;">
      <h4>Uploaded Documents</h4>
      <ul id="docHistoryList" style="font-size:0.9rem;"></ul>
    </div>
  \`;

  container.appendChild(panel);

  document.getElementById("toggleHistory").onclick = () => {
    const hist = document.getElementById("historyPanel");
    hist.style.display = hist.style.display === "block" ? "none" : "block";
  };
}

export function addToHistory(filename) {
  const list = document.getElementById("docHistoryList");
  if (list) {
    const item = document.createElement("li");
    item.textContent = filename;
    list.appendChild(item);
  }
}