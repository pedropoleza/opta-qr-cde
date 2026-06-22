import { authEnabled } from "@/lib/supabase/config";
import { OrganizationClient } from "@/components/org/organization-client";

export const dynamic = "force-dynamic";

export default function OrganizationPage() {
  return <OrganizationClient multiTenant={authEnabled()} />;
}
