let sessionUploads = 0;
let sessionMails = 0;

export function renderUserDashboard(container, navigate) {
  container.innerHTML = `
    <nav>
      <a href="#" onclick="navigate('/dashboard')">🏠 Dashboard</a>
      <a href="#" onclick="navigate('/admin')">🔐 Admin</a>
    </nav>
    <div style="padding:1rem;">
      <h2>📊 Welcome to Your Dashboard</h2>

      <section style="margin-top:1.5rem;">
        <h3>📂 Session Activity</h3>
        <p>Uploads: <strong id="uploadCount">\${sessionUploads}</strong></p>
        <p>Mail Requests: <strong id="mailCount">\${sessionMails}</strong></p>
        <button onclick="simulateUpload()">Simulate Upload</button>
        <button onclick="simulateMail()">Simulate Mail</button>
      </section>

      <section style="margin-top:2rem;">
        <h3>📝 Profile</h3>
        <input id="profileName" value="John Doe" placeholder="Full Name" style="margin:0.5rem 0;width:100%;" />
        <input id="profileEmail" value="user@domain.com" placeholder="Email" style="width:100%;" />
        <button onclick="saveProfile()">💾 Save Profile</button>
        <p id="saveMsg" style="margin-top:0.5rem;color:green;"></p>
      </section>

      <section style="margin-top:2rem;">
        <h3>💼 Subscription</h3>
        <p>Tier: <strong>Premium</strong></p>
        <p>Features: Unlimited uploads, document tracking, mail delivery</p>
      </section>
    </div>
    <footer>
      <a href="#" onclick="navigate('/admin')">Admin Access</a>
    </footer>
  `;
}

export function updateSessionStats() {
  document.getElementById("uploadCount").textContent = sessionUploads;
  document.getElementById("mailCount").textContent = sessionMails;
}

window.simulateUpload = () => {
  sessionUploads++;
  updateSessionStats();
};

window.simulateMail = () => {
  sessionMails++;
  updateSessionStats();
};

window.saveProfile = () => {
  const name = document.getElementById("profileName").value;
  const email = document.getElementById("profileEmail").value;
  const msg = document.getElementById("saveMsg");
  msg.textContent = `✅ Saved for ${name} (${email})`;
};