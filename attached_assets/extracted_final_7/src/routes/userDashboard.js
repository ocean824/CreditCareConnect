export function renderUserDashboard(container) {
  container.innerHTML = `
    <div style="padding:2rem;max-width:800px;margin:auto;">
      <h2>👤 Welcome, User</h2>
      <section style="margin-top:2rem;">
        <h3>📁 Saved Documents</h3>
        <ul id="savedDocsList" style="background:#f9fafb;padding:1rem;border-radius:10px;">
          <li>invoice_oct.pdf</li>
          <li>medical_claim_2023.png</li>
          <li>bank_statement_march.pdf</li>
        </ul>
      </section>

      <section style="margin-top:2rem;">
        <h3>⚙️ Profile Settings</h3>
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <input id="username" type="text" value="John Doe" style="padding:0.5rem;" />
          <input id="useremail" type="email" value="user@domain.com" style="padding:0.5rem;" />
          <button onclick="saveUserProfile()" style="padding:0.5rem;width:150px;">💾 Save</button>
        </div>
        <p id="saveMsg" style="margin-top:1rem;color:green;"></p>
      </section>

      <section style="margin-top:2rem;">
        <h3>💼 Account Tier</h3>
        <div style="background:#fef3c7;padding:1rem;border-radius:10px;">
          <strong>Tier:</strong> Premium<br/>
          <strong>Features:</strong> Unlimited uploads, mail services, document tracking
        </div>
      </section>
    </div>
  `;
}

window.saveUserProfile = () => {
  const name = document.getElementById("username").value;
  const email = document.getElementById("useremail").value;
  const msg = document.getElementById("saveMsg");
  msg.textContent = `✅ Profile updated for ${name} (${email})`;
};