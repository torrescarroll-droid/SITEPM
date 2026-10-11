import { requireCompanyContext } from "@/lib/auth-context";
export type DocumentFamily = {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  category: string;
  collection: string;
  trade: string;
  notes: string;
  current_document_id: string | null;
  archived: boolean;
  revision: number;
  updated_at: string;
};
export type DocumentVersion = {
  document_id: string;
  family_id: string;
  version_number: number;
  issue_label: string;
  issued_on: string | null;
  verified_at: string | null;
  processing_state: string;
  documents: {
    filename: string;
    content_type: string;
    byte_size: number;
    sha256: string;
    status: string;
    created_at: string;
  };
};
export async function listDocumentFamilies(filters: {
  project?: string;
  query?: string;
  archived?: boolean;
  offset?: number;
}) {
  const { supabase } = await requireCompanyContext();
  const r = await supabase.rpc("search_document_families", {
    p_project: filters.project ?? null,
    p_query: filters.query ?? "",
    p_archived: filters.archived ?? false,
    p_offset: filters.offset ?? 0,
  });
  if (r.error) throw Error("The document desk could not load. Please retry.");
  return r.data as DocumentFamily[];
}
export async function documentFamilyDetail(id: string) {
  const { supabase, profile } = await requireCompanyContext();
  if (!profile?.company_id) return null;
  const f = await supabase
    .from("document_families")
    .select("*")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!f.data) return null;
  const [versions, events, links] = await Promise.all([
    supabase
      .from("document_versions")
      .select(
        "*,documents(filename,content_type,byte_size,sha256,status,created_at)",
      )
      .eq("family_id", id)
      .order("version_number", { ascending: false })
      .limit(100),
    supabase
      .from("document_events")
      .select("id,kind,document_id,actor_id,details,occurred_at")
      .eq("family_id", id)
      .order("id", { ascending: false })
      .limit(100),
    supabase
      .from("document_links")
      .select("*")
      .eq("family_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (versions.error || events.error || links.error)
    throw Error("Document history could not load.");
  return {
    family: f.data as DocumentFamily,
    versions: versions.data as unknown as DocumentVersion[],
    events: events.data,
    links: links.data,
  };
}
