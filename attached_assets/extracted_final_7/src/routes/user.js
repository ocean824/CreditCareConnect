
export function renderUserLogin(container) {
  container.innerHTML = `
    <div style="padding:2rem;max-width:400px;margin:auto;text-align:center;">
      <h2>👤 User Login</h2>
      <input id="userEmail" type="email" placeholder="Email" style="width:100%;margin:1rem 0;padding:0.5rem;" />
      <input id="userPassword" type="password" placeholder="Password" style="width:100%;margin-bottom:1rem;padding:0.5rem;" />
      <button onclick="validateUserLogin()" style="width:100%;padding:0.5rem;">Login</button>
      <p style="margin-top:1rem;">
        <a href="#" onclick="simulateForgotPassword('user')">Forgot Password?</a>
      </p>
      <div id="userLoginMsg" style="margin-top:1rem;color:green;"></div>
    </div>
  `;
}


window.validateUserLogin = () => {
  const email = document.getElementById("userEmail").value;
  const pass = document.getElementById("userPassword").value;
  const msg = document.getElementById("userLoginMsg");
  if (email === "user@domain.com" && pass === "user1234") {
    msg.textContent = "✅ Logged in! Redirecting to dashboard...";
    setTimeout(() => mountUserDashboard(), 1500);
  } else {
    msg.textContent = "❌ Invalid email or password.";
    msg.style.color = "red";
  }
};

