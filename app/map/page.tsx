import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { MapApp } from "@/components/MapApp";
import type { AppUser, Comment } from "@/lib/types";

/** Unngår avkortet «A.» i iOS PWA-tittellinje – logo vises i app-header. */
export const metadata: Metadata = {
  title: "Kart",
  appleWebApp: {
    title: " ",
  },
};

export default async function MapPage() {
  if (!isSupabaseConfigured) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: comments } = await supabase
    .from("comments_with_author")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    redirect("/login?error=no-organization");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, is_active")
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (!organization?.is_active) {
    redirect("/login?error=organization-inactive");
  }

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, is_admin")
    .order("full_name", { ascending: true });

  return (
    <MapApp
      initialComments={(comments as Comment[]) ?? []}
      currentUserId={user.id}
      currentUserName={profile.full_name ?? user.email ?? "Meg"}
      currentUserIsAdmin={profile.is_admin ?? false}
      organizationId={profile.organization_id}
      organizationName={organization.name}
      users={(users as AppUser[]) ?? []}
    />
  );
}
