import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { auth } from '@elynd/auth/server';

/** Paths excluded from the `api` global prefix (must match bootstrap + OpenAPI gen). */
export const API_GLOBAL_PREFIX_EXCLUDE = ['health'] as const;

export function applyApiGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: [...API_GLOBAL_PREFIX_EXCLUDE],
  });
}

function withAuthBasePath(path: string, basePath: string): string {
  if (path.startsWith(basePath)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${suffix}`;
}

function mergeOpenApiDocuments(nestDoc: OpenAPIObject, authDoc: OpenAPIObject, authBasePath: string): OpenAPIObject {
  const authPaths: OpenAPIObject['paths'] = {};
  for (const [path, item] of Object.entries(authDoc.paths ?? {})) {
    if (!item) continue;
    const prefixedItem = { ...item };
    for (const [method, operation] of Object.entries(prefixedItem)) {
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) continue;
      const op = operation as { tags?: string[] };
      if (op.tags?.includes('Default')) {
        op.tags = op.tags.map((tag) => (tag === 'Default' ? 'Authentication' : tag));
      }
      (prefixedItem as Record<string, unknown>)[method] = op;
    }
    authPaths[withAuthBasePath(path, authBasePath)] = prefixedItem;
  }

  const authTags = (authDoc.tags ?? [])
    .map((tag) =>
      tag.name === 'Default'
        ? { ...tag, name: 'Authentication', description: tag.description || 'Better Auth session endpoints' }
        : tag,
    )
    .filter((tag, index, arr) => arr.findIndex((t) => t.name === tag.name) === index);

  const nestTags = nestDoc.tags ?? [];
  const mergedTags = [...nestTags];
  for (const tag of authTags) {
    if (!mergedTags.some((existing) => existing.name === tag.name)) {
      mergedTags.push(tag);
    }
  }

  return {
    ...nestDoc,
    paths: {
      ...(nestDoc.paths ?? {}),
      ...authPaths,
    },
    tags: mergedTags,
    components: {
      ...(nestDoc.components ?? {}),
      ...(authDoc.components ?? {}),
      schemas: {
        ...(nestDoc.components?.schemas ?? {}),
        ...(authDoc.components?.schemas ?? {}),
      },
      securitySchemes: {
        ...(nestDoc.components?.securitySchemes ?? {}),
        ...(authDoc.components?.securitySchemes ?? {}),
      },
    },
  };
}

/**
 * Build the OpenAPI document from Nest controllers + Better Auth routes (no UI).
 */
export async function createOpenApiDocument(app: INestApplication): Promise<OpenAPIObject> {
  const config = new DocumentBuilder()
    .setTitle('Elynd API')
    .setDescription(
      'Elynd Nest API. Health is anonymous; authentication uses Better Auth cookie sessions under `/api/auth`.',
    )
    .setVersion('1.0')
    .addTag('System', 'Process and readiness checks')
    .addTag('Authentication', 'Better Auth email/password and username session endpoints')
    .build();

  const nestDoc = SwaggerModule.createDocument(app, config, {});
  const authDoc = (await auth.api.generateOpenAPISchema()) as OpenAPIObject;
  return mergeOpenApiDocuments(nestDoc, authDoc, '/api/auth');
}
