export interface AccessTokenPayload {
  sub: string; // userId
}

export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");

export interface TokenServicePort {
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}
