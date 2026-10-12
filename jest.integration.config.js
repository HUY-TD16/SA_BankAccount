const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  roots: ['<rootDir>/test/integration'],
};
