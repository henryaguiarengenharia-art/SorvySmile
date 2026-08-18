import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebaseClient";

export type AssistantAssetKind = "avatar" | "full";

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

export async function uploadApprovedAssistantAsset(input: {
  file: File;
  accountId: string;
  professionalId?: string;
  kind: AssistantAssetKind;
}): Promise<string> {
  if (!input.accountId) throw new Error("Selecione uma conta antes de enviar a imagem.");
  if (!["image/png", "image/webp"].includes(input.file.type)) {
    throw new Error("Use uma imagem PNG ou WebP com fundo transparente quando necessário.");
  }
  if (input.file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem da assistente deve ter no máximo 5 MB.");
  }
  const bitmap = await createImageBitmap(input.file);
  const minimum = input.kind === "avatar" ? 512 : 800;
  const dimensionsAreValid = bitmap.width >= minimum && bitmap.height >= minimum;
  bitmap.close();
  if (!dimensionsAreValid) {
    throw new Error(input.kind === "avatar"
      ? "O avatar precisa ter pelo menos 512 × 512 px."
      : "A imagem completa precisa ter pelo menos 800 × 800 px.");
  }
  const extension = input.file.type === "image/png" ? "png" : "webp";
  const accountId = safePathPart(input.accountId);
  const professionalId = safePathPart(input.professionalId ?? "account");
  const target = ref(
    storage,
    `assistant-assets/${accountId}/${professionalId}/${input.kind}-${Date.now()}.${extension}`,
  );
  await uploadBytes(target, input.file, {
    contentType: input.file.type,
    customMetadata: {
      accountId: input.accountId,
      professionalId: input.professionalId ?? "",
      assetKind: input.kind,
      approvalSource: "sorvy_hq",
    },
  });
  return getDownloadURL(target);
}
