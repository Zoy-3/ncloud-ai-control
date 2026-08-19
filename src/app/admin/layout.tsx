import { requireSignedInAdmin } from "@/lib/auth/guard";

/** Every page under /admin is administrator-only, checked server-side. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSignedInAdmin();

  return <>{children}</>;
}
