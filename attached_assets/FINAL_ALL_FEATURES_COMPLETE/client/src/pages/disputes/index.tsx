import React, { useState } from 'react'

export default function DisputeGenerator() {
  const [form, setForm] = useState({ bureau: '', creditor: '', error: '', law: '' })
  const [pdf, setPdf] = useState(null)

  const submit = async () => {
    const res = await fetch('/api/disputes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    setPdf(url)
  }

  return (
    <div>
      <h1>Dispute Letter Generator</h1>
      <label>Bureau: <input onChange={e => setForm({ ...form, bureau: e.target.value })} /></label>
      <label>Creditor: <input onChange={e => setForm({ ...form, creditor: e.target.value })} /></label>
      <label>Error Type: <input onChange={e => setForm({ ...form, error: e.target.value })} /></label>
      <label>Law: 
        <select onChange={e => setForm({ ...form, law: e.target.value })}>
          <option value="">-- Choose Law --</option>
          <option value="FCRA">FCRA</option>
          <option value="FDCPA">FDCPA</option>
          <option value="Metro2">Metro 2</option>
        </select>
      </label>
      <button onClick={submit}>Generate PDF</button>
      {pdf && <a href={pdf} download="dispute.pdf">Download Dispute Letter</a>}
    </div>
  )
}
