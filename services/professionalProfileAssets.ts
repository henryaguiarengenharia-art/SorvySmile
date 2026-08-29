import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebaseClient";

export type ProfessionalAssetKind = "profile" | "cover";

const MAX_BYTES = 5 * 1024 * 1024;

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

async function normalizedImage(file: File, kind: ProfessionalAssetKind): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Envie uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > MAX_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.');
  const bitmap = await createImageBitmap(file);
  const targetWidth = kind === 'profile' ? 800 : 1600;
  const targetHeight = kind === 'profile' ? 800 : 720;
  const scale = Math.max(targetWidth / bitmap.width, targetHeight / bitmap.height);
  const sourceWidth = targetWidth / scale;
  const sourceHeight = targetHeight / scale;
  const sourceX = Math.max(0, (bitmap.width - sourceWidth) / 2);
  const sourceY = Math.max(0, (bitmap.height - sourceHeight) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')),
    'image/webp',
    0.88,
  ));
}

export async function uploadProfessionalAsset(input: {
  file: File;
  accountId: string;
  professionalId: string;
  kind: ProfessionalAssetKind;
}): Promise<string> {
  const blob = await normalizedImage(input.file, input.kind);
  const accountId = safePathPart(input.accountId);
  const professionalId = safePathPart(input.professionalId);
  const target = ref(storage, `professional-assets/${accountId}/${professionalId}/${input.kind}-${Date.now()}.webp`);
  await uploadBytes(target, blob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(target);
}
