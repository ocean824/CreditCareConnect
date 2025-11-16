const sessionMemory = {}

export function storeMemory(sessionId, message) {
  if (!sessionMemory[sessionId]) sessionMemory[sessionId] = []
  sessionMemory[sessionId].push(message)
  if (sessionMemory[sessionId].length > 10) sessionMemory[sessionId].shift()
}

export function getMemory(sessionId) {
  return sessionMemory[sessionId] || []
}
