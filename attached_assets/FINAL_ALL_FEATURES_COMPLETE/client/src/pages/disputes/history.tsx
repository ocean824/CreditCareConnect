import React, { useEffect, useState } from 'react'

export default function DisputeHistory() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch('/api/disputes/user')
      .then(res => res.json())
      .then(data => setHistory(data))
  }, [])

  return (
    <div>
      <h2>Your Dispute History</h2>
      {history.map((h, idx) => (
        <div key={idx} style={{ border: '1px solid #ccc', padding: '10px' }}>
          <p><strong>Creditor:</strong> {h.creditor}</p>
          <p><strong>Bureau:</strong> {h.bureau}</p>
          <p><strong>Date:</strong> {new Date(h.createdAt).toLocaleDateString()}</p>
          <a href={h.pdfPath} download>Download Letter</a>
        </div>
      ))}
    </div>
  )
}
