import express from 'express'
import fs from 'fs'
import path from 'path'

const router = express.Router()

router.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body
  if (!to || !subject || !body) return res.status(400).send('Missing email details')

  // Simulate write to outbox (demo only, no real email service)
  const logPath = path.join(__dirname, '../logs/outbox.txt')
  const entry = `To: ${to}\nSubject: ${subject}\nBody: ${body}\n---\n`
  fs.appendFileSync(logPath, entry)

  res.status(200).send('Email recorded (simulation)')
})

export default router
