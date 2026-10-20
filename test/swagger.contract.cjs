// Run after npm run build. Uses real Nest/Swagger and controllers, without a database.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { setupSwagger } = require('../dist/common/http/swagger/swagger.config');
const { AuthController } = require('../dist/modules/identity/presentation/http/auth.controller');
const { AccountsController } = require('../dist/modules/accounts/presentation/http/accounts.controller');
const { TransactionController } = require('../dist/modules/money-movement/presentation/http/transactions.controller');
const { TransfersController } = require('../dist/modules/money-movement/presentation/http/transfers.controller');

const controllers = [AuthController, AccountsController, TransactionController, TransfersController];
const dependencies = [...new Set(controllers.flatMap(controller =>
  Reflect.getMetadata('design:paramtypes', controller) ?? []))];
class DocumentationModule {}
Module({
  controllers,
  providers: dependencies.map(provide => ({ provide, useValue: {} })),
})(DocumentationModule);

async function createApp(environment) {
  process.env.NODE_ENV = environment;
  const app = await NestFactory.create(DocumentationModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  setupSwagger(app);
  await app.listen(0, '127.0.0.1');
  return app;
}

function responseSchema(operation, status) {
  return operation.responses[status].content['application/json'].schema;
}

async function main() {
  const originalEnvironment = process.env.NODE_ENV;
  let app;
  try {
    app = await createApp('development');
    const origin = await app.getUrl();
    const response = await fetch(`${origin}/api/docs.json`);
    assert.equal(response.status, 200);
    const document = await response.json();
    assert.equal((await fetch(`${origin}/api/docs`)).status, 200);
    assert.equal(document.servers[0].url, '/');
    const operations = [];
    for (const [path, methods] of Object.entries(document.paths)) {
      assert.ok(path.startsWith('/api/v1/'), path);
      assert.ok(!path.includes('/api/v1/api/v1/'), path);
      for (const [method, operation] of Object.entries(methods)) {
        operations.push(`${method} ${path}`);
        assert.ok(operation.tags.every(tag => document.tags.some(item => item.name === tag)));
        if (path.includes('/auth/')) {
          assert.ok(!operation.security?.length, 'Auth routes must be public');
        } else {
          assert.deepEqual(operation.security, [{ 'access-token': [] }]);
        }
        for (const [status, result] of Object.entries(operation.responses)) {
          assert.ok(result.headers['X-Request-Id']);
          if (status === '204') {
            assert.ok(!result.content, '204 must have no response body');
          } else {
            const schema = responseSchema(operation, status);
            assert.ok(schema.required.includes('meta'));
            assert.deepEqual(schema.properties.success.enum, [Number(status) < 400]);
            assert.ok(schema.required.includes(Number(status) < 400 ? 'data' : 'error'));
          }
        }
        assert.ok(operation.responses['400']);
        assert.ok(operation.responses['500']);
        if (!path.includes('/auth/')) assert.ok(operation.responses['401']);
      }
    }
    assert.equal(operations.length, 9);
    const schemas = document.components.schemas;
    assert.ok(schemas.RegisterDto.required.includes('confirmPassword'));
    assert.ok(new RegExp(schemas.RegisterDto.properties.password.pattern)
      .test(schemas.RegisterDto.properties.password.example));
    assert.equal(schemas.TransferMoneyDto.properties.amount.type, 'string');
    assert.ok(new RegExp(schemas.TransferMoneyDto.properties.amount.pattern).test('100000'));
    assert.ok(!new RegExp(schemas.TransferMoneyDto.properties.amount.pattern).test('0'));
    for (const path of ['/api/v1/accounts', '/api/v1/accounts/{accountId}/transactions']) {
      const operation = document.paths[path].get;
      const schema = responseSchema(operation, '200');
      assert.equal(schema.properties.data.type, 'array');
      assert.ok(schema.required.includes('pagination'));
      const limit = operation.parameters.find(parameter => parameter.name === 'limit');
      assert.equal(limit.schema.maximum, 100);
    }
    const transfer = document.paths['/api/v1/transfers'].post;
    assert.ok(transfer.parameters.some(parameter =>
      parameter.in === 'header' && parameter.name === 'Idempotency-Key' && parameter.required));
    assert.deepEqual(responseSchema(transfer, '200'), responseSchema(transfer, '201'));
    const user = responseSchema(document.paths['/api/v1/auth/register'].post, '201').properties.data;
    assert.ok(user.properties.createAt);
    assert.ok(!user.properties.passwordHash);
    assert.equal(document.components.securitySchemes['access-token'].scheme, 'bearer');
    await app.close();
    app = await createApp('production');
    for (const path of ['/api/docs', '/api/docs.json']) {
      assert.equal((await fetch(`${await app.getUrl()}${path}`)).status, 404);
    }
    console.log(`Swagger contract passed: ${operations.length} operations, schemas, auth, pagination, UI/JSON routes and production gating.`);
  } finally {
    if (app) await app.close();
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
