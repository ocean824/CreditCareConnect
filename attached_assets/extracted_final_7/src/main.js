
import { renderUserDashboard } from './routes/userDashboard.js';

function mountUser() {
  renderUserLogin(root);
}

window.mountUserDashboard = () => {
  root.innerHTML = '';
  renderUserDashboard(root);
};
