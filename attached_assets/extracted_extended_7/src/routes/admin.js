export function renderAdminLogin(container, navigate) {
  container.innerHTML = `
    <div style="max-width:400px;margin:auto;padding:2rem;text-align:center;">
      <h2>🔐 Admin Panel</h2>
      <input id="adminEmail" type="email" placeholder="Admin Email" style="width:100%;margin:1rem 0;" />
      <input id="adminPassword" type="password" placeholder="Password" style="width:100%;" />
      <button onclick="validateAdminLogin()">Login</button>
      <p><a href="#" onclick="simulateForgotPassword('admin')">Forgot Password?</a></p>
      <div id="adminLoginMsg" style="margin-top:1rem;"></div>
    </div>
  `;
}

window.validateAdminLogin = () => {
  const email = document.getElementById("adminEmail").value;
  const pass = document.getElementById("adminPassword").value;
  const msg = document.getElementById("adminLoginMsg");
  if (email === "admin@creditcare.com" && pass === "admin1234") {
    msg.textContent = "✅ Admin access granted. Full Tier Enabled.";
    msg.style.color = "green";
  } else {
    msg.textContent = "❌ Access denied.";
    msg.style.color = "red";
  }
};