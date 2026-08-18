import { DailyPostAssignment, DailyPostVariant } from "../types";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebaseClient";

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (context.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate; }
  if (line) lines.push(line); return lines;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error("Imagem indisponível")); image.src = url; });
}

export async function downloadDailyPostPng(assignment: DailyPostAssignment, format: "feed" | "story", variant?: DailyPostVariant | null): Promise<void> {
  const width = 1080; const height = format === "feed" ? 1350 : 1920;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Seu navegador não conseguiu gerar a arte.");
  const content = assignment.contentSnapshot; const accent = variant?.paletteKey || content.paletteKey || "#18AFA5";
  const title = variant?.title || content.title; const displayName = variant?.displayName || "Seu consultório"; const cta = variant?.ctaText || content.ctaText;
  context.fillStyle = "#F5F9FC"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#123B5D"; context.fillRect(0, 0, width, format === "feed" ? 170 : 240);
  context.fillStyle = accent; context.fillRect(0, format === "feed" ? 170 : 240, width, 22);
  if (variant?.imageUrl || content.defaultImageUrl) {
    try {
      const image = await loadImage(variant?.imageUrl || content.defaultImageUrl);
      const size = format === "feed" ? 280 : 360; const x = width - size - 70; const yImage = format === "feed" ? 245 : 330;
      context.save(); context.beginPath(); context.roundRect(x, yImage, size, size, 48); context.clip();
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight); const sourceWidth = size / scale; const sourceHeight = size / scale;
      context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, x, yImage, size, size); context.restore();
    } catch { /* A arte continua válida sem a imagem opcional. */ }
  }
  if (!(variant?.imageUrl || content.defaultImageUrl)) { context.fillStyle = accent; context.beginPath(); context.arc(900, format === "feed" ? 360 : 520, 180, 0, Math.PI * 2); context.fill(); }
  context.fillStyle = "#FFFFFF"; context.font = "700 36px Inter, sans-serif"; context.fillText("SORVYSMILE", 80, format === "feed" ? 105 : 145);
  context.fillStyle = "#183247"; context.font = "700 74px Poppins, Inter, sans-serif"; let y = format === "feed" ? 360 : 530;
  for (const line of wrap(context, title, 820).slice(0, 4)) { context.fillText(line, 80, y); y += 90; }
  context.fillStyle = "#607487"; context.font = "500 38px Inter, sans-serif"; y += 35;
  for (const line of wrap(context, content.shortText, 860).slice(0, format === "feed" ? 5 : 7)) { context.fillText(line, 80, y); y += 55; }
  const ctaY = height - (format === "feed" ? 250 : 360); context.fillStyle = accent; context.roundRect(80, ctaY, 920, 120, 30); context.fill();
  context.fillStyle = "#FFFFFF"; context.font = "700 36px Inter, sans-serif"; context.textAlign = "center"; context.fillText(cta, 540, ctaY + 74);
  context.textAlign = "left"; context.fillStyle = "#183247"; context.font = "600 30px Inter, sans-serif"; context.fillText(displayName, 80, height - 80);
  if (variant?.instagramHandle) { context.textAlign = "right"; context.fillText(variant.instagramHandle, 1000, height - 80); }
  const link = document.createElement("a"); link.download = `post-do-dia-${assignment.assignmentDate}-${format}.png`; link.href = canvas.toDataURL("image/png"); link.click();
}

export async function uploadDailyPostImage(file: File, assignment: DailyPostAssignment): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 1080 || bitmap.height < 1080) throw new Error("A imagem precisa ter pelo menos 1080 × 1080 px.");
  const maxSide = 2400; const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d"); if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível preparar a imagem.")), "image/webp", 0.9));
  const target = ref(storage, `daily-posts/professionals/${assignment.professionalId}/${assignment.id}/custom-${Date.now()}.webp`);
  await uploadBytes(target, blob, { contentType: "image/webp", customMetadata: { assignmentId: assignment.id } });
  return getDownloadURL(target);
}
