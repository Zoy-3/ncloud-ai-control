import { redirect } from "next/navigation";

import { readCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * The application root.
 *
 * Nothing is rendered here: the session is resolved on the server first, so no
 * dashboard content exists before the visitor is known to be entitled to it.
 */
export default async function RootPage() {
  const user = await readCurrentAdmin();

  if (user === null) {
    redirect("/login");
  }

  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}
