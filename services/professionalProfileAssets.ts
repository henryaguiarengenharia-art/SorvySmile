import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebaseStorageClient";

export type ProfessionalAssetKind = "profile" | "cover";

const MAX_BYTES = 5 * 1024 * 1024;

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

async function validateImage(file: File, kind: ProfessionalAssetKind): Promise<void> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Envie uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > MAX_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.');
  const bitmap = await createImageBitmap(file);
  const minimumWidth = kind === 'profile' ? 400 : 900;
  const minimumHeight = kind === 'profile' ? 400 : 360;
  const validDimensions = bitmap.width >= minimumWidth && bitmap.height >= minimumHeight;
  bitmap.close();
  if (!validDimensions) {
    throw new Error(kind === 'profile'
      ? 'A foto precisa ter pelo menos 400 × 400 px.'
      : 'A capa precisa ter pelo menos 900 × 360 px.');
  }
}

export async function uploadProfessionalAsset(input: {
  file: File;
  accountId: string;
  professionalId: string;
  kind: ProfessionalAssetKind;
}): Promise<string> {
  await validateImage(input.file, input.kind);
  const accountId = safePathPart(input.accountId);
  const professionalId = safePathPart(input.professionalId);
  const extension = input.file.type === 'image/jpeg' ? 'jpg' : input.file.type.split('/')[1];
  const target = ref(storage, `professional-assets/${accountId}/${professionalId}/${input.kind}-${Date.now()}.${extension}`);
  await uploadBytes(target, input.file, {
    contentType: input.file.type,
    cacheControl: 'public,max-age=31536000,immutable',
    customMetadata: {
      accountId: input.accountId,
      professionalId: input.professionalId,
      assetKind: input.kind,
    },
  });
  return getDownloadURL(target);
}
