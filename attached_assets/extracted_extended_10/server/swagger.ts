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
      return res.status(500).json({ message: "Server misconfiguration: SWAGGER_ADMIN_TOKEN not set" });
    }
    const token = req.headers['x-admin-token'];
    
    if (token && typeof token === 'string' && token.length === validToken.length) {
      try {
        const isValid = timingSafeEqual(Buffer.from(token), Buffer.from(validToken));
        if (isValid) return swaggerUi.serve(req, res, next);
      } catch {
        // Buffer conversion failed, treat as invalid
      }
    }
    
    return res.status(403).json({ message: "Forbidden: Admin token required" });
  }, swaggerUi.setup(swaggerSpec));
}