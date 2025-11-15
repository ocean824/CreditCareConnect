export function simulateForgotPassword(role) {
  const email = prompt("Enter your email to reset your password:");
  if (email) {
    alert(`📨 A password reset link has been sent to ${email}.`);
    const msgEl = document.getElementById(role + "LoginMsg");
    if (msgEl) {
      msgEl.textContent = "Check your inbox for a reset link.";
      msgEl.style.color = "blue";
    }
  }
}