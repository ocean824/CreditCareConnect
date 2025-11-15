export function renderUserLogin(container, navigate) {
  container.innerHTML = `
    <div style="max-width:400px;margin:auto;padding:2rem;text-align:center;">
      <h2>👤 User Login</h2>
      <input id="userEmail" type="email" placeholder="Email" style="width:100%;margin:1rem 0;" />
      <input id="userPassword" type="password" placeholder="Password" style="width:100%;" />
      <button onclick="validateUserLogin(navigate)">Login</button>
      <p><a href="#" onclick="simulateForgotPassword('user')">Forgot Password?</a></p>
      <div id="userLoginMsg" style="margin-top:1rem;"></div>
    </div>
  `;
}

export function validateUserLogin(navigate) {
  const email = document.getElementById("userEmail").value;
  const password = document.getElementById("userPassword").value;
  const msg = document.getElementById("userLoginMsg");
  // CRITICAL SECURITY FIX: Hardcoded credentials removed
  // Client-side authentication is inherently insecure and can be easily bypassed
  // Implement proper server-side authentication using secure methods
  msg.textContent = "❌ Authentication disabled. Implement server-side authentication.";
  msg.style.color = "red";
}