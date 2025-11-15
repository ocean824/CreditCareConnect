export function renderPrintPreview(doc = "sample-document.pdf") {
  const modal = document.createElement("div");
  modal.innerHTML = \`
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:1000;">
      <div style="background:#fff;border-radius:1rem;padding:2rem;max-width:500px;width:90%;text-align:center;box-shadow:0 0 20px rgba(0,0,0,0.2);">
        <h2>🖨️ Print Preview</h2>
        <p><strong>Document:</strong> \${doc}</p>
        <p>This is a preview of how your document would be printed and mailed.</p>
        <div style="margin:1rem 0;padding:1rem;background:#f9fafb;border-radius:10px;">
          <p style="font-size:0.9rem;">Sender: CreditCareConnect</p>
          <p style="font-size:0.9rem;">Recipient: User Address (simulated)</p>
          <p style="font-size:0.9rem;">Pages: 3 (estimated)</p>
        </div>
        <button onclick="this.closest('div[style^=position]').remove()" style="margin-right:1rem;">Cancel</button>
        <button onclick="alert('✅ Sent to Click2Mail (simulated)')">Send</button>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);
}