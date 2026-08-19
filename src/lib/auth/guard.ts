import "server-only";

import { redirect } from "next/navigation";

import { readCurrentAdmin } from "@/lib/auth/admin";
import type { AdminUser } from "@/lib/auth/admin-users";

/**
 * Server-side gate for every protected page.
 *
 * This runs on the server before any page content is produced, so an
 * unauthenticated visitor never receives the application at all — the
 * protection does not depend on anything the browser chooses to run.
 *
 * An administrator who still has to set a password is sent to do that first,
 * so a temporary password cannot be used to browse the application.
 */
export async function requireSignedInAdmin(): Promise<AdminUser> {
  const user = await readCurrentAdmin();

  if (user === null) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return user;
}
