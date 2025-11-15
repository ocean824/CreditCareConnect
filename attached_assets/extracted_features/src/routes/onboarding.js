export function showOnboarding() {
  const modal = document.createElement('div');
  modal.innerHTML = \`
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;">
      <div style="background:white;padding:2rem;border-radius:1rem;text-align:center;width:80%;max-width:400px;">
        <h2>👋 Welcome to CreditCareConnect!</h2>
        <p>This is an offline simulation. Upload your document, toggle mail delivery, and test workflows.</p>
        <button onclick="this.parentElement.parentElement.remove()">Let's Go</button>
      </div>
    </div>\`;
  document.body.appendChild(modal);
}

window.onload = () => showOnboarding();