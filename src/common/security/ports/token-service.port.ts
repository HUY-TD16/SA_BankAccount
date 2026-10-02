export interface AccessTokenPayload {
  sub: string; // userId
}

export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");

export interface TokenServicePort {
  signAccessToken(userId: string): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}
