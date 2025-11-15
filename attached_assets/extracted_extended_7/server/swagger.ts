import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { timingSafeEqual } from 'crypto';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CreditCareConnect API',
    version: '1.0.0',
    description: 'Protected API documentation'
  },
  servers: [{ url: 'http://localhost:4000' }]
};

const options = {
  swaggerDefinition,
  apis: ['./server/routes/*.ts']
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app) {
  app.use('/docs', (req, res, next) => {
    const validToken = process.env.SWAGGER_ADMIN_TOKEN;
    if (!validToken) {
      return res.status(503).json({ message: "Service unavailable: Documentation access not configured" });
    }
    const token = req.headers['x-admin-token'];
    if (token && typeof token === 'string' && 
        timingSafeEqual(Buffer.from(token), Buffer.from(validToken))) {
      return swaggerUi.serve(req, res, next);
    }
    return res.status(403).json({ message: "Forbidden: Admin token required" });
  }, swaggerUi.setup(swaggerSpec));
}