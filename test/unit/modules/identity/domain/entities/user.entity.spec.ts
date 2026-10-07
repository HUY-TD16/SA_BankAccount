import { User } from '@src/modules/identity/domain/entities/user.entity';

describe('User Entity', () => {
  it('toSafeObject() trả về object an toàn, KHÔNG chứa passwordHash', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    const user = new User(
      'user-123',
      'user@example.com',
      'Nguyen Van A',
      '$2b$12$somehashedpassword',
      createdAt,
      updatedAt,
    );

    const safe = user.toSafeObject();

    expect(safe).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      createAt: '2026-01-01T00:00:00.000Z',
    });
    expect(safe).not.toHaveProperty('passwordHash');
  });
});
