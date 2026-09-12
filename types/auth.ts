export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
  permissions: Record<string, string> | null;
}
