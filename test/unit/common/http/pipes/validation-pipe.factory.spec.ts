import { ValidationError as NestValidationError } from '@nestjs/common';
import {
  createValidationPipeOptions,
  createGlobalValidationPipe,
} from '@src/common/http/pipes/validation-pipe.factory';
import { ValidationError } from '@src/common/domain/errors/common.errors';

describe('validation-pipe.factory', () => {
  describe('createValidationPipeOptions()', () => {
    it('trả về config với whitelist enabled', () => {
      expect(createValidationPipeOptions().whitelist).toBe(true);
    });

    it('trả về config với forbidNonWhitelisted enabled', () => {
      expect(createValidationPipeOptions().forbidNonWhitelisted).toBe(true);
    });

    it('trả về config với transform enabled', () => {
      expect(createValidationPipeOptions().transform).toBe(true);
    });

    it('có exceptionFactory được định nghĩa', () => {
      expect(createValidationPipeOptions().exceptionFactory).toBeDefined();
    });
  });

  describe('exceptionFactory', () => {
    it('convert NestValidationError thành ValidationError (AppError)', () => {
      const { exceptionFactory } = createValidationPipeOptions();
      const nestErrors: NestValidationError[] = [
        {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
          children: [],
        } as NestValidationError,
      ];

      const result = exceptionFactory!(nestErrors);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.httpStatus).toBe(400);
      expect(result.details).toEqual([
        { field: 'email', reason: 'email must be an email' },
      ]);
    });

    it('flatten nested validation errors', () => {
      const { exceptionFactory } = createValidationPipeOptions();
      const nestErrors: NestValidationError[] = [
        {
          property: 'address',
          constraints: {},
          children: [
            {
              property: 'street',
              constraints: { isNotEmpty: 'street should not be empty' },
              children: [],
            } as NestValidationError,
          ],
        } as NestValidationError,
      ];

      const result = exceptionFactory!(nestErrors);

      expect(result.details).toEqual([
        { field: 'address.street', reason: 'street should not be empty' },
      ]);
    });

    it('combine multiple constraints từ một field', () => {
      const { exceptionFactory } = createValidationPipeOptions();
      const nestErrors: NestValidationError[] = [
        {
          property: 'password',
          constraints: {
            minLength: 'password must be longer than 8 characters',
            matches: 'password must contain at least one number',
          },
          children: [],
        } as NestValidationError,
      ];

      const result = exceptionFactory!(nestErrors);

      expect(result.details).toHaveLength(2);
      expect(result.details).toEqual(
        expect.arrayContaining([
          { field: 'password', reason: 'password must be longer than 8 characters' },
          { field: 'password', reason: 'password must contain at least one number' },
        ]),
      );
    });

    it('handle multiple top-level errors', () => {
      const { exceptionFactory } = createValidationPipeOptions();
      const nestErrors: NestValidationError[] = [
        {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
          children: [],
        } as NestValidationError,
        {
          property: 'age',
          constraints: { isInt: 'age must be an integer' },
          children: [],
        } as NestValidationError,
      ];

      const result = exceptionFactory!(nestErrors);
      expect(result.details).toHaveLength(2);
    });
  });

  describe('createGlobalValidationPipe()', () => {
    it('trả về instance ValidationPipe', () => {
      const pipe = createGlobalValidationPipe();
      expect(pipe).toBeDefined();
      expect(pipe.constructor.name).toBe('ValidationPipe');
    });
  });
});
