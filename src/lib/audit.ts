import { createClient } from "@/lib/supabase/server";

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  let actorName = user.email ?? "Unknown";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.full_name) actorName = profile.full_name;

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_name: actorName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
  });
}
