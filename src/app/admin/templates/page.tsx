import type { Metadata } from "next";

import { AdminGate } from "@/components/admin/admin-gate";
import { TemplateManager } from "@/components/admin/template-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template Manager",
  description: "Manage the central NCloud template library.",
};

/**
 * The NCloud template manager.
 *
 * Nothing here receives the admin secret or any Supabase credential: the
 * browser only ever calls this app's own admin API, which re-checks the
 * session server-side on every request.
 */
export default function AdminTemplatesPage() {
  return (
    <AdminGate
      title="Template Manager"
      description="The central template library shared by every connected WordPress site."
    >
      <TemplateManager />
    </AdminGate>
  );
}
