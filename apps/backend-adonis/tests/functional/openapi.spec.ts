import { test } from '@japa/runner';

test.group('OpenAPI docs', () => {
  test('serves Swagger UI at /api-docs', async ({ client, assert }) => {
    const response = await client.get('/api-docs');

    response.assertStatus(200);
    assert.include(response.text(), 'swagger');
  });

  test('serves OpenAPI JSON without documenting itself', async ({ client, assert }) => {
    const response = await client.get('/api-docs.json');

    response.assertStatus(200);
    const body = response.body();
    assert.equal(body.info?.title, 'Elynd API');
    assert.property(body.paths, '/api/auth/login');
    assert.property(body.paths, '/api/auth/register');
    assert.notProperty(body.paths, '/api-docs');
    assert.notProperty(body.paths, '/api-docs.json');
    assert.equal(body.paths['/api/auth/login']?.post?.summary, 'Login');
  });
});
