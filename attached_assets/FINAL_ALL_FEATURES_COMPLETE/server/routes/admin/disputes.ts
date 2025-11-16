import express from 'express'

const router = express.Router()

let allDisputes = []

export function saveDispute(entry) {
  allDisputes.push(entry)
}

router.get('/', (_, res) => {
  res.json(allDisputes)
})

export default router
