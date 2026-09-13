export type RefreshTokenRecord = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  familyId: string;
};

export type AccessTokenClaims = {
  sub: string;
  fam: string;
  jti: string;
  iat: number;
  exp: number;
};

export type RefreshTokenRepository = {
  create: (token: RefreshTokenRecord) => Promise<RefreshTokenRecord>;
  findByHash: (tokenHash: string) => Promise<RefreshTokenRecord | null>;
  listByFamily: (familyId: string) => Promise<RefreshTokenRecord[]>;
  listByUser: (userId: string) => Promise<RefreshTokenRecord[]>;
  save: (token: RefreshTokenRecord) => Promise<RefreshTokenRecord>;
  revokeFamily: (familyId: string, at: Date) => Promise<void>;
  revokeAllForUser: (userId: string, at: Date) => Promise<void>;
};

export type TokenSigner = {
  sign: (claims: AccessTokenClaims) => string;
  verify: (token: string) => AccessTokenClaims;
};
