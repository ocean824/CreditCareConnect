import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CreditCareConnect API',
    version: '1.0.0',
    description: 'Backend API documentation for CreditCareConnect'
  },
  servers: [{ url: 'http://localhost:4000' }]
};

const options = {
  swaggerDefinition,
  apis: ['./server/routes/*.ts']
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}