import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../server/index'

describe('API Health Check', () => {
  it('should return 200 for /api/healthz', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.status).toBe(200)
  })
})
