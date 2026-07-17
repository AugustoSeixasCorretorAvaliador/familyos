import { NextResponse, type NextRequest } from "next/server";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "family-health";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user || !family) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: exam, error: readError } = await supabase
    .from("health_exams")
    .select("file_path")
    .eq("id", params.id)
    .eq("family_id", family.id)
    .maybeSingle();

  if (readError) {
    const result = reportActionError({
      error: readError,
      userId: user.id,
      familyId: family.id,
      module: "saude",
      action: "download_exam_read",
      fallback: "read_failed",
    });
    return NextResponse.redirect(new URL(errorRedirectPath("/saude", result), request.url));
  }

  if (!exam?.file_path) {
    return NextResponse.redirect(new URL("/saude?error=file_not_found", request.url));
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(exam.file_path, 60);

  if (error || !data?.signedUrl) {
    const result = reportActionError({
      error: error ?? new Error("signed_url_missing"),
      userId: user.id,
      familyId: family.id,
      module: "saude",
      action: "download_exam_signed_url",
      fallback: "signed_url_failed",
    });
    return NextResponse.redirect(new URL(errorRedirectPath("/saude", result), request.url));
  }

  return NextResponse.redirect(data.signedUrl);
}
