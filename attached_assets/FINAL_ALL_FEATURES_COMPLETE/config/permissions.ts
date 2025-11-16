export type Role = "user" | "admin";
export type Action = 
  | "credit_reports:read"
  | "credit_reports:write"
  | "violations:read"
  | "dispute_letters:read"
  | "dispute_letters:write"
  | "admin:users:read"
  | "admin:users:write"
  | "admin:stats:read"
  | "admin:audit:read";

const permissions: Record<Role, Action[]> = {
  user: [
    "credit_reports:read",
    "credit_reports:write",
    "violations:read",
    "dispute_letters:read",
    "dispute_letters:write"
  ],
  admin: [
    "credit_reports:read",
    "credit_reports:write",
    "violations:read",
    "dispute_letters:read",
    "dispute_letters:write",
    "admin:users:read",
    "admin:users:write",
    "admin:stats:read",
    "admin:audit:read"
  ]
};

export function can(role: Role, action: Action): boolean {
  return permissions[role]?.includes(action) || false;
}
