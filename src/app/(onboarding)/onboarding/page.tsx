import { createClient } from "@/server/supabase/server";
import { Wizard } from "./wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const { data: businessTypes } = await supabase
    .from("business_types")
    .select("id, name, slug")
    .order("name");

  return <Wizard businessTypes={businessTypes || []} />;
}
