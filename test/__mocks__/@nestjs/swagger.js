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
    addBearerAuth() { return this; }
    build() { return {}; }
  },
};
