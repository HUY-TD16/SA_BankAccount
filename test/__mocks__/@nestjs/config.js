'use strict';

/**
 * Manual CJS mock của @nestjs/config cho Jest unit tests.
 */
function registerAs(token, configFactory) {
  const factory = () => configFactory();
  factory.KEY = `CONFIGURATION_TOKEN_${token}`;
  return factory;
}

class ConfigService {
  constructor(internalConfig = {}) {
    this.internalConfig = internalConfig;
  }

  get(key) {
    return this.internalConfig[key];
  }
}

class ConfigModule {
  static forRoot() {
    return { module: ConfigModule };
  }

  static forFeature() {
    return { module: ConfigModule };
  }
}

module.exports = {
  registerAs,
  ConfigService,
  ConfigModule,
};
