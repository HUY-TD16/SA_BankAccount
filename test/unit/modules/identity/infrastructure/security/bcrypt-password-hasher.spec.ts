import { BcryptPasswordHasher } from '@src/modules/identity/infrastructure/security/bcrypt-password-hasher';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('BcryptPasswordHasher', () => {
  let hasher: BcryptPasswordHasher;
  const mockConfig = {
    port: 3000,
    globalPrefix: 'api/v1',
    bcryptRounds: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasher = new BcryptPasswordHasher(mockConfig as any);
  });

  it('hash() gọi bcrypt.hash với plaintext và số rounds từ config', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_output');

    const result = await hasher.hash('plainSecret123');

    expect(bcrypt.hash).toHaveBeenCalledWith('plainSecret123', 10);
    expect(result).toBe('hashed_output');
  });

  it('compare() gọi bcrypt.compare với plaintext và hash', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await hasher.compare('plainSecret123', 'hashed_output');

    expect(bcrypt.compare).toHaveBeenCalledWith('plainSecret123', 'hashed_output');
    expect(result).toBe(true);
  });
});
