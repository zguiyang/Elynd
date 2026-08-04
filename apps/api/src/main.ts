import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module.js';
import { createComponents } from './swagger/zod-schema-registry.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: ['health', 'api-doc', 'api-doc/(.*)'],
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Elynd API')
    .setDescription('Elynd Nest API documentation')
    .setVersion('1.0')
    .addTag('elynd')
    .build();

  const openApiDoc = SwaggerModule.createDocument(app, config, {});

  try {
    const zodComponents = createComponents();
    openApiDoc.components = {
      ...(openApiDoc.components || {}),
      schemas: {
        ...((openApiDoc.components && openApiDoc.components.schemas) || {}),
        ...(zodComponents.schemas as Record<string, object>),
      },
    };
  } catch (err) {
    console.warn('Failed to create Zod OpenAPI components:', (err as Error).message);
  }

  SwaggerModule.setup(
    'api-doc',
    app,
    cleanupOpenApiDoc(openApiDoc, {
      version: '3.0',
    }),
    {
      jsonDocumentUrl: '/api-doc/json',
    },
  );

  const port = process.env.PORT ?? 3336;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
