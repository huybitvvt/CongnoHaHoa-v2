export function StaffIdentity({ value }: { value?: string | null }) {
  if (!value) return <span>—</span>;
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const name = email ? value.replace(email, "").replace(/[\s·,;–-]+$/, "").trim() : value;
  return <span className="staff-identity"><span>{name || email}</span>{email && name && <small>{email}</small>}</span>;
}
