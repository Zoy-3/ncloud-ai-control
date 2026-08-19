import { requireSignedInAdmin } from "@/lib/auth/guard";

/**
 * Every page under /dashboard is administrator-only.
 *
 * The check happens here, on the server, so it applies to each page in the
 * segment without any of them having to remember to ask.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSignedInAdmin();

  return <>{children}</>;
}
