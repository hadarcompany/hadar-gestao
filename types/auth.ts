export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Record<string, string> | null;
}
