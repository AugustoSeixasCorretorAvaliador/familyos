import { NextResponse, type NextRequest } from "next/server";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "family-documents";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user || !family) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: document } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", params.id)
    .eq("family_id", family.id)
    .maybeSingle();

  if (!document?.storage_path || document.storage_path === "pending") {
    return NextResponse.redirect(new URL("/documentos?error=file_not_found", request.url));
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.redirect(new URL("/documentos?error=signed_url_failed", request.url));
  }

  return NextResponse.redirect(data.signedUrl);
}
