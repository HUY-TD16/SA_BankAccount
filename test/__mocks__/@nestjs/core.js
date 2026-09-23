'use strict';
/**
 * Manual CJS mock của @nestjs/core cho Jest unit tests.
 * Chỉ stub những gì src/common/* import — hiện tại chỉ có Reflector.
 */

class Reflector {
  getAllAndOverride() { return undefined; }
  get()              { return undefined; }
  getAll()           { return []; }
}

module.exports = { Reflector };
