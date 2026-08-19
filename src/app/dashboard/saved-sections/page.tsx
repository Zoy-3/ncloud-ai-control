import type { Metadata } from "next";

import { AdminGate } from "@/components/admin/admin-gate";
import { SavedSectionsInspector } from "@/components/admin/saved-sections-inspector";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Sections",
  description: "Inspect sections saved by connected WordPress sites.",
};

/**
 * Central inspection of site-owned saved sections.
 *
 * This is deliberately separate from Sections: `sections` is the shared NCloud
 * template library, while `saved_sections` belongs to one site each. The two
 * are never merged.
 */
export default function SavedSectionsPage() {
  return (
    <AdminGate
      title="Saved Sections"
      description="Sections saved by connected WordPress sites. Each one belongs to a single site and is never shared."
    >
      <SavedSectionsInspector />
    </AdminGate>
  );
}
