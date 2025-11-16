import React, { useEffect, useState } from 'react'

export default function AdminDisputeViewer() {
  const [disputes, setDisputes] = useState([])

  useEffect(() => {
    fetch('/api/admin/disputes')
      .then(res => res.json())
      .then(data => setDisputes(data))
  }, [])

  return (
    <div>
      <h2>All User Disputes (Admin)</h2>
      {disputes.map((d, idx) => (
        <div key={idx} style={{ border: '1px solid gray', margin: 10, padding: 10 }}>
          <p><strong>User:</strong> {d.userId || 'anonymous'}</p>
          <p><strong>Creditor:</strong> {d.creditor}</p>
          <p><strong>Bureau:</strong> {d.bureau}</p>
          <p><strong>Date:</strong> {new Date(d.createdAt).toLocaleString()}</p>
          <a href={d.pdfPath} download>📥 Download Letter</a>
        </div>
      ))}
    </div>
  )
}
