import swaggerJsdoc from 'swagger-jsdoc'
import { env } from './env'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Project Management Platform API',
      version: '1.0.0',
      description: 'Multi-tenant project management platform REST API',
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1`, description: 'Development' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)
