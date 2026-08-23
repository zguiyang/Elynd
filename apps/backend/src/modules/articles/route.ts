import { Hono } from 'hono';

import { HTTP_STATUS } from '@/constants';
import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import * as articlesService from '@/modules/articles/service';
import {
  validateAdminArticleListQuery,
  validateCatalogArticleListQuery,
  validateCreateArticle,
  validateUpdateArticle,
} from '@/modules/articles/validator';

export const articlesRoutes = new Hono<{ Variables: AuthVariables }>();

articlesRoutes.post('/api/admin/articles', requireAdmin, validateCreateArticle, async (c) => {
  const body = c.req.valid('json');
  const article = await articlesService.createArticle(body);
  return c.json(article, HTTP_STATUS.CREATED);
});

articlesRoutes.get('/api/admin/articles', requireAdmin, validateAdminArticleListQuery, async (c) => {
  const data = await articlesService.listAdminArticles(c.req.valid('query'));
  return c.json(data);
});

articlesRoutes.get('/api/admin/articles/:id', requireAdmin, async (c) => {
  const article = await articlesService.getAdminArticle(c.req.param('id'));
  return c.json(article);
});

articlesRoutes.patch('/api/admin/articles/:id', requireAdmin, validateUpdateArticle, async (c) => {
  const article = await articlesService.updateArticle(c.req.param('id'), c.req.valid('json'));
  return c.json(article);
});

articlesRoutes.post('/api/admin/articles/:id/publish', requireAdmin, async (c) => {
  const article = await articlesService.publishArticle(c.req.param('id'));
  return c.json(article);
});

articlesRoutes.post('/api/admin/articles/:id/unpublish', requireAdmin, async (c) => {
  const article = await articlesService.unpublishArticle(c.req.param('id'));
  return c.json(article);
});

articlesRoutes.delete('/api/admin/articles/:id', requireAdmin, async (c) => {
  await articlesService.deleteArticle(c.req.param('id'));
  return c.body(null, HTTP_STATUS.NO_CONTENT);
});

articlesRoutes.get('/api/articles', requireAuth, validateCatalogArticleListQuery, async (c) => {
  const data = await articlesService.listPublishedArticles(c.req.valid('query'));
  return c.json(data);
});

articlesRoutes.get('/api/articles/:id', requireAuth, async (c) => {
  const article = await articlesService.getPublishedArticle(c.req.param('id'));
  return c.json(article);
});
