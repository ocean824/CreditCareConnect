import express from 'express'
import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'

const router = express.Router()

router.post('/generate', async (req, res) => {
  const { bureau, creditor, error, law } = req.body
  if (!bureau || !creditor || !error || !law) return res.status(400).send('Missing fields')

  const doc = new PDFDocument()
  const tempPath = path.join(__dirname, `temp-${Date.now()}.pdf`)
  const stream = fs.createWriteStream(tempPath)
  doc.pipe(stream)

  doc.fontSize(16).text(`Dispute Letter`, { align: 'center' })
  doc.moveDown()
  doc.text(`To: ${bureau}`)
  doc.text(`Creditor: ${creditor}`)
  doc.text(`Issue: ${error}`)
  doc.text(`Legal Basis: ${law}`)
  doc.text(`
This letter is a formal request under ${law} to investigate and correct the above-listed inaccuracy.`)
  doc.end()

  stream.on('finish', () => {
    res.download(tempPath, 'dispute-letter.pdf', () => {
      fs.unlinkSync(tempPath)
    })
  })
})

export default router
