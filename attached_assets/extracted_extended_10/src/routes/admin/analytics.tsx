import React from 'react';

export default function AdminAnalytics() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Supabase Analytics Dashboard</h1>
      <ul className="space-y-2">
        <li>Total Users: [simulated]</li>
        <li>Total Uploaded Files: [simulated]</li>
        <li>Email Logs Sent: [simulated]</li>
        <li>Signed Documents: [simulated]</li>
      </ul>
      <p className="mt-4 text-sm text-gray-500">Note: This is a static simulation for admin view only.</p>
    </div>
  );
}