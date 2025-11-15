import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { date: 'Nov 1', users: 12, files: 5 },
  { date: 'Nov 2', users: 15, files: 9 },
  { date: 'Nov 3', users: 18, files: 13 },
  { date: 'Nov 4', users: 22, files: 16 },
  { date: 'Nov 5', users: 27, files: 19 }
];

export default function RealtimeChart() {
  return (
    <div className="p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-3">📈 Real-time Upload/User Trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={mockData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="users" stroke="#8884d8" name="New Users" />
          <Line type="monotone" dataKey="files" stroke="#82ca9d" name="Files Uploaded" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}