import { renderUserLogin, validateUserLogin } from './routes/user.js';
import { renderUserDashboard, updateSessionStats } from './routes/userDashboard.js';
import { renderAdminLogin } from './routes/admin.js';
import { simulateForgotPassword } from './lib/forgotPassword.js';

const root = document.getElementById("app");

function navigate(path) {
  window.location.hash = path;
  mount();
}

function mount() {
  const route = window.location.hash.replace("#", "") || "/";
  root.innerHTML = "";

  if (route === "/") {
    renderUserLogin(root, navigate);
  } else if (route === "/dashboard") {
    renderUserDashboard(root, navigate);
  } else if (route === "/admin") {
    renderAdminLogin(root, navigate);
  }
}

window.validateUserLogin = validateUserLogin;
window.simulateForgotPassword = simulateForgotPassword;
window.navigate = navigate;
window.updateSessionStats = updateSessionStats;

mount();