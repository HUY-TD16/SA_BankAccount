'use strict';

/**
 * Manual CJS mock của @nestjs/swagger cho Jest unit tests.
 */
const noopDecorator = () => () => {};

module.exports = {
  ApiTags: noopDecorator,
  ApiOperation: noopDecorator,
  ApiResponse: noopDecorator,
  ApiProperty: noopDecorator,
  ApiPropertyOptional: noopDecorator,
  ApiBearerAuth: noopDecorator,
  ApiHeader: noopDecorator,
  ApiParam: noopDecorator,
  ApiQuery: noopDecorator,
  ApiBody: noopDecorator,
  SwaggerModule: {
    createDocument: () => ({}),
    setup: () => {},
  },
  DocumentBuilder: class {
    setTitle() { return this; }
    setDescription() { return this; }
    setVersion() { return this; }
    addServer() { return this; }
    addTag() { return this; }
    addBearerAuth() { return this; }
    build() { return {}; }
  },
};
