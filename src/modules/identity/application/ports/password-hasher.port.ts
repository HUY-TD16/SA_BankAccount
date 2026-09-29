export const PASSWORD_HASHER = "PASSWORD_HASHER";

export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
}
