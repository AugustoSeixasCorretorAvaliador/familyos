"use server";

import { canEditFamily, getFamilyContext } from "@/lib/family/context";
import { FinanceImportBlockedError } from "@/lib/finance/import-service";
import { commitFinanceImportArchive, previewFinanceImportArchive } from "@/lib/finance/services";
import type { FinanceImportCommitResult, FinanceImportPreview } from "@/lib/finance/services";

const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;

export type ImportActionResult = {
  ok: boolean;
  error?: string;
  preview?: FinanceImportPreview;
  commit?: FinanceImportCommitResult;
};

async function authenticatedArchive(formData: FormData) {
  const context = await getFamilyContext();
  if (!context.user || !context.family || !canEditFamily(context)) throw new Error("Você não possui permissão para importar dados nesta família.");
  if (formData.has("family_id") || formData.has("user_id") || formData.has("owner_id")) throw new Error("Identificadores de sessão não podem ser enviados pelo cliente.");
  const file = formData.get("archive");
  if (!(file instanceof File) || !file.name.toLocaleLowerCase("pt-BR").endsWith(".zip")) throw new Error("Selecione o arquivo ZIP oficial.");
  if (file.size === 0 || file.size > MAX_ARCHIVE_BYTES) throw new Error("O ZIP deve ter entre 1 byte e 5 MB.");
  return { context, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function previewFinanceImport(formData: FormData): Promise<ImportActionResult> {
  try {
    const { context, bytes } = await authenticatedArchive(formData);
    const preview = await previewFinanceImportArchive(context.family!.id, context.user!.id, bytes);
    return { ok: true, preview };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao gerar a Preview." };
  }
}

export async function commitFinanceImport(formData: FormData): Promise<ImportActionResult> {
  try {
    const { context, bytes } = await authenticatedArchive(formData);
    const digest = formData.get("expected_digest");
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("A Preview precisa ser gerada novamente.");
    const commit = await commitFinanceImportArchive(context.family!.id, context.user!.id, bytes, digest);
    return { ok: true, commit };
  } catch (error) {
    if (error instanceof FinanceImportBlockedError) {
      return { ok: false, error: `${error.message} ${error.issues.map((issue) => issue.code).join(", ")}` };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao importar o pacote." };
  }
}
