import React, { useState } from 'react';

export default function AdminImpersonation() {
  const [userEmail, setUserEmail] = useState('');
  const handleImpersonate = () => {
    console.log(`👤 Impersonating user: ${userEmail}`);
    // Simulate role switch
    alert(`Now viewing app as ${userEmail}`);
  };

  return (
    <div className="my-4">
      <label className="block mb-2 font-medium">🔁 View as User</label>
      <input
        value={userEmail}
        onChange={e => setUserEmail(e.target.value)}
        placeholder="Enter user's email"
        className="border p-2 mr-2 rounded"
      />
      <button onClick={handleImpersonate} className="bg-blue-600 text-white px-3 py-1 rounded">
        Impersonate
      </button>
    </div>
  );
}