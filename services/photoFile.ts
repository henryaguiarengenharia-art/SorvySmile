export interface PreparedPhoto {
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg";
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const CONVERTIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

function photoError(message: string): Error {
  return new Error(message);
}

export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
  ) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

function loadImage(blob: Blob): Promise<{
  image: HTMLImageElement;
  release: () => void;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    const release = () => URL.revokeObjectURL(objectUrl);

    image.onload = () => resolve({ image, release });
    image.onerror = () => {
      release();
      reject(
        photoError(
          "Não foi possível abrir esta imagem. Tente fotografar novamente ou escolha uma foto JPG, PNG ou WebP.",
        ),
      );
    };
    image.decoding = "async";
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(photoError("Não foi possível preparar a foto para análise."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function normalizeToJpeg(source: Blob): Promise<Blob> {
  const loaded = await loadImage(source);
  try {
    const width = loaded.image.naturalWidth;
    const height = loaded.image.naturalHeight;
    if (!width || !height) {
      throw photoError("A foto selecionada está vazia ou corrompida.");
    }

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw photoError("Seu navegador não conseguiu preparar a foto.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(loaded.image, 0, 0, canvas.width, canvas.height);

    let jpeg = await canvasToJpeg(canvas, 0.88);
    if (jpeg.size > MAX_OUTPUT_BYTES) jpeg = await canvasToJpeg(canvas, 0.72);
    if (jpeg.size > MAX_OUTPUT_BYTES) {
      throw photoError("A foto continuou muito grande após a otimização. Tente outra foto.");
    }
    return jpeg;
  } finally {
    loaded.release();
  }
}

export async function preparePhotoFile(file: File): Promise<PreparedPhoto> {
  if (!file.size) throw photoError("A foto selecionada está vazia.");
  if (file.size > MAX_SOURCE_BYTES) {
    throw photoError("A foto original deve ter no máximo 20 MB.");
  }

  let sourceBuffer: ArrayBuffer;
  try {
    // Copia a foto antes que o input seja limpo. Isso evita perder o arquivo
    // temporário em câmeras e seletores móveis.
    sourceBuffer = await file.arrayBuffer();
  } catch {
    throw photoError(
      "Não foi possível acessar a foto. Tente fotografar novamente ou escolha outra imagem.",
    );
  }

  const sourceBytes = new Uint8Array(sourceBuffer);
  const detectedType = detectImageMimeType(sourceBytes);
  const declaredType = file.type.trim().toLowerCase();
  const sourceType = detectedType
    ?? (CONVERTIBLE_IMAGE_TYPES.has(declaredType) ? declaredType : "");
  if (!sourceType) {
    throw photoError("O arquivo selecionado não é uma imagem compatível.");
  }

  const source = new Blob([sourceBuffer], { type: sourceType });
  const normalized = await normalizeToJpeg(source);
  const normalizedBytes = new Uint8Array(await normalized.arrayBuffer());
  const base64 = bytesToBase64(normalizedBytes);
  return {
    dataUrl: `data:image/jpeg;base64,${base64}`,
    base64,
    mimeType: "image/jpeg",
  };
}
