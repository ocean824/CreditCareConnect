import express from 'express'

const router = express.Router()
const savedDisputes = []

router.post('/save', (req, res) => {
  const { bureau, creditor, error, law, pdfPath } = req.body
  const entry = {
    bureau, creditor, error, law, pdfPath,
    createdAt: new Date().toISOString()
  }
  savedDisputes.push(entry)
  res.status(200).send('Saved')
})

router.get('/user', (_, res) => {
  res.json(savedDisputes)
})

export default router
