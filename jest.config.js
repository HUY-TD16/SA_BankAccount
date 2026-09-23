/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/unit'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    // NestJS 12 xuất bản pure ESM — Jest CommonJS không thể require() trực tiếp.
    // Dùng manual CJS mock thay thế để unit test không phụ thuộc vào NestJS runtime.
    '^@nestjs/common$': '<rootDir>/test/__mocks__/@nestjs/common.js',
    '^@nestjs/core$':   '<rootDir>/test/__mocks__/@nestjs/core.js',
  },
  // transformIgnorePatterns giữ mặc định — mock đã xử lý @nestjs/common và core
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {
    // Chỉ compile .ts/.tsx — mock .js files của @nestjs/* là plain CJS, không cần ts-jest
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        moduleResolution: 'node',
        module: 'commonjs',
        target: 'ES2022',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        types: ['node', 'jest'],
        baseUrl: '.',
        paths: { '@src/*': ['src/*'] },
      },
      useESM: false,
    }],
  },
  // reflect-metadata phải load trước mọi test vì decorators của NestJS cần nó
  setupFiles: ['<rootDir>/test/helpers/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/app.module.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
