export type AuthContext = {
  userId: string;
  email?: string;
  token: string;
  familyId: string;
  role: "owner" | "admin" | "member" | "viewer";
  clientName?: string;
  clientVersion?: string;
  userAgent?: string;
  googleAccessToken?: string;
  googleScopes: string[];
};

export type AuditEntry = {
  tool: string;
  userId: string;
  familyId: string;
  durationMs: number;
  success: boolean;
  ip: string;
  error?: string;
};

export type RequestMetadata = {
  requestId: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  clientName?: string;
  clientVersion?: string;
};
