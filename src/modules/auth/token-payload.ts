export interface AuthTokenPayload {
  sub: number;
  email?: string;
  role?: string[];
  type: 'access' | 'refresh';
  tokenVersion?: number;
  exp?: number;
}
