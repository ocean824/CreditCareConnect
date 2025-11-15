export function renderDashboard(container) {
  container.innerHTML = `
    <section style="margin-bottom:2rem;">
      <h2 style="font-size:1.5rem;margin-bottom:1rem;">📊 CreditCare Dashboard</h2>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;">
        <div style="flex:1;min-width:200px;background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          <h4>📄 Uploaded Docs</h4>
          <p id="uploadCount">0 this session</p>
        </div>
        <div style="flex:1;min-width:200px;background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          <h4>📬 Mail Requests</h4>
          <p id="mailCount">0 simulated</p>
        </div>
      </div>
    </section>
  `;
}

export function updateDashboard(uploadCount = 0, mailCount = 0) {
  const upload = document.getElementById('uploadCount');
  const mail = document.getElementById('mailCount');
  if (upload) upload.textContent = `${uploadCount} this session`;
  if (mail) mail.textContent = `${mailCount} simulated`;
}