import fs from 'fs'
import path from 'path'

export const auditLogger = (req, res, next) => {
  const logEntry = {
    time: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    user: req.user?.email || 'guest',
    ip: req.ip
  }
  const logPath = path.join(__dirname, 'logs', 'audit.log')
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n')
  next()
}
