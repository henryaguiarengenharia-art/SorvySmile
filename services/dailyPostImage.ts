import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { DailyPostAssignment, DailyPostVariant } from "../types";
import {
  DAILY_POST_DIMENSIONS,
  DailyPostExportFormat,
  fitMeasuredText,
  resolveDailyPostRenderContent,
} from "./dailyPostLayout";
import { storage } from "./firebaseStorageClient";
import { createStoredZip } from "./storedZip";

const FONT_STACK = '"Inter", "Aptos", "Segoe UI", Arial, sans-serif';
const DISPLAY_STACK = '"Poppins", "Inter", "Aptos Display", "Segoe UI", Arial, sans-serif';
const NAVY = "#071D32";
const NAVY_LIGHT = "#0C304B";
const WHITE = "#F8FAFC";
const MUTED = "#C8D5E1";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: number,
  family = FONT_STACK,
): void {
  context.font = weight + " " + size + "px " + family;
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawTrackingText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cursor = x;
  for (const character of text) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + tracking;
  }
}

function drawToothWatermark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  accent: string,
): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = hexToRgba(accent, 0.14);
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 14);
  context.bezierCurveTo(-20, -10, -54, 4, -50, 42);
  context.bezierCurveTo(-47, 70, -30, 93, -25, 128);
  context.bezierCurveTo(-20, 166, -4, 170, 8, 132);
  context.bezierCurveTo(18, 101, 30, 101, 40, 132);
  context.bezierCurveTo(52, 170, 68, 166, 73, 128);
  context.bezierCurveTo(78, 93, 95, 70, 98, 42);
  context.bezierCurveTo(102, 4, 68, -10, 48, 14);
  context.bezierCurveTo(34, 30, 14, 30, 0, 14);
  context.stroke();
  context.restore();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Imagem indisponível"));
    image.src = url;
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  accent: string,
): void {
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
  const overlay = context.createLinearGradient(x, y, x, y + height);
  overlay.addColorStop(0, "rgba(7,29,50,0.02)");
  overlay.addColorStop(1, "rgba(7,29,50,0.38)");
  context.fillStyle = overlay;
  context.fillRect(x, y, width, height);
  context.restore();
  context.strokeStyle = hexToRgba(accent, 0.7);
  context.lineWidth = 3;
  roundedRect(context, x, y, width, height, radius);
  context.stroke();
}

async function prepareAssets(input: {
  imageUrl: string;
  logoUrl: string;
  includeLogo: boolean;
}): Promise<{ hero: HTMLImageElement | null; logo: HTMLImageElement | null }> {
  const [hero, logo] = await Promise.all([
    input.imageUrl ? loadImage(input.imageUrl).catch(() => null) : Promise.resolve(null),
    input.includeLogo && input.logoUrl
      ? loadImage(input.logoUrl).catch(() => null)
      : Promise.resolve(null),
  ]);
  return { hero, logo };
}

function drawBrand(
  context: CanvasRenderingContext2D,
  input: {
    logo: HTMLImageElement | null;
    accent: string;
    formatLabel: string;
    isStory: boolean;
  },
): void {
  const top = input.isStory ? 104 : 76;
  let brandX = 76;
  if (input.logo) {
    const logoSize = input.isStory ? 72 : 60;
    context.save();
    roundedRect(context, 76, top - 45, logoSize, logoSize, 18);
    context.clip();
    context.drawImage(input.logo, 76, top - 45, logoSize, logoSize);
    context.restore();
    brandX += logoSize + 22;
  }
  setFont(context, input.isStory ? 40 : 34, 800, DISPLAY_STACK);
  context.fillStyle = WHITE;
  context.fillText("SORVY", brandX, top);
  const sorvyWidth = context.measureText("SORVY").width;
  context.fillStyle = input.accent;
  context.fillText("SMILE", brandX + sorvyWidth + 9, top);
  setFont(context, input.isStory ? 19 : 17, 700);
  context.fillStyle = MUTED;
  drawTrackingText(context, "CONTEÚDO PARA O SEU SORRISO", brandX, top + 34, 1.2);

  context.textAlign = "right";
  setFont(context, input.isStory ? 17 : 15, 800);
  context.fillStyle = input.accent;
  drawTrackingText(
    context,
    input.formatLabel,
    1000 - context.measureText(input.formatLabel).width - input.formatLabel.length * 1.1,
    top - 4,
    1.1,
  );
  context.textAlign = "left";
  context.fillStyle = hexToRgba(input.accent, 0.25);
  roundedRect(context, 790, top + 28, 210, 10, 5);
  context.fill();
  context.fillStyle = input.accent;
  roundedRect(context, 950, top + 28, 50, 10, 5);
  context.fill();
}

function drawPremiumPost(
  context: CanvasRenderingContext2D,
  assignment: DailyPostAssignment,
  format: DailyPostExportFormat,
  variant: DailyPostVariant | null | undefined,
  assets: { hero: HTMLImageElement | null; logo: HTMLImageElement | null },
  slideIndex?: number,
): void {
  const { width, height } = DAILY_POST_DIMENSIONS[format];
  const isStory = format === "story";
  const baseContent = resolveDailyPostRenderContent(assignment, variant);
  const slides = assignment.contentSnapshot.carouselSlides ?? [];
  const selectedSlide =
    typeof slideIndex === "number" && slides[slideIndex]
      ? slides[slideIndex]
      : null;
  const content = selectedSlide
    ? {
        ...baseContent,
        title: selectedSlide.title,
        body: selectedSlide.text,
        cta:
          slideIndex === slides.length - 1
            ? baseContent.cta
            : slideIndex === 0
              ? "Deslize para ver os pontos práticos"
              : "Continue para a próxima página",
        formatLabel: "CARROSSEL · " + String((slideIndex ?? 0) + 1) + "/" + String(slides.length),
      }
    : baseContent;
  const margin = 76;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, NAVY);
  gradient.addColorStop(0.7, "#082640");
  gradient.addColorStop(1, NAVY_LIGHT);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = hexToRgba(content.accent, 0.34);
  context.lineWidth = 2;
  roundedRect(context, 28, 28, width - 56, height - 56, 38);
  context.stroke();

  drawBrand(context, {
    logo: assets.logo,
    accent: content.accent,
    formatLabel: content.formatLabel,
    isStory,
  });

  const dividerY = isStory ? 205 : 164;
  const divider = context.createLinearGradient(margin, dividerY, width - margin, dividerY);
  divider.addColorStop(0, content.accent);
  divider.addColorStop(0.3, hexToRgba(content.accent, 0.35));
  divider.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = divider;
  roundedRect(context, margin, dividerY, width - margin * 2, 3, 2);
  context.fill();

  const pillY = isStory ? 266 : 218;
  setFont(context, isStory ? 20 : 17, 800);
  const hookWidth = Math.min(
    width - margin * 2,
    context.measureText(content.hook).width + (isStory ? 64 : 54),
  );
  context.fillStyle = hexToRgba(content.accent, 0.17);
  roundedRect(context, margin, pillY, hookWidth, isStory ? 62 : 52, 28);
  context.fill();
  context.strokeStyle = hexToRgba(content.accent, 0.55);
  context.lineWidth = 1.5;
  roundedRect(context, margin, pillY, hookWidth, isStory ? 62 : 52, 28);
  context.stroke();
  context.fillStyle = content.accent;
  drawTrackingText(context, content.hook, margin + 27, pillY + (isStory ? 39 : 34), 1.1);

  const titleY = isStory ? 405 : 340;
  const imageBox = assets.hero
    ? {
        x: isStory ? 620 : 680,
        y: isStory ? 352 : 302,
        width: isStory ? 380 : 320,
        height: isStory ? 300 : 230,
      }
    : null;
  if (imageBox && assets.hero) {
    drawCoverImage(
      context,
      assets.hero,
      imageBox.x,
      imageBox.y,
      imageBox.width,
      imageBox.height,
      isStory ? 40 : 34,
      content.accent,
    );
  } else {
    drawToothWatermark(
      context,
      isStory ? 770 : 795,
      isStory ? 380 : 300,
      isStory ? 2.25 : 1.85,
      content.accent,
    );
  }

  const titleWidth = imageBox ? imageBox.x - margin - 48 : width - margin * 2;
  const titleFit = fitMeasuredText({
    text: content.title,
    maxWidth: titleWidth,
    maxHeight: isStory ? 330 : 245,
    maxLines: imageBox ? 4 : isStory ? 4 : 3,
    preferredFontSize: isStory ? 84 : 72,
    minimumFontSize: isStory ? 54 : 48,
    lineHeightRatio: 1.08,
    measure: (text, fontSize) => {
      setFont(context, fontSize, 800, DISPLAY_STACK);
      return context.measureText(text).width;
    },
  });
  setFont(context, titleFit.fontSize, 800, DISPLAY_STACK);
  context.fillStyle = WHITE;
  const titleBottom = drawLines(
    context,
    titleFit.lines,
    margin,
    titleY,
    titleFit.lineHeight,
  );

  const bodyY = Math.max(
    titleBottom + (isStory ? 96 : 72),
    imageBox ? imageBox.y + imageBox.height + (isStory ? 88 : 60) : 0,
  );
  setFont(context, isStory ? 18 : 16, 800);
  context.fillStyle = content.accent;
  drawTrackingText(context, "O QUE VOCÊ PRECISA SABER", margin, bodyY, 1.35);

  const ctaY = isStory ? 1390 : 915;
  const bodyTop = bodyY + (isStory ? 62 : 50);
  const bodyFit = fitMeasuredText({
    text: content.body,
    maxWidth: width - margin * 2,
    maxHeight: ctaY - bodyTop - (isStory ? 90 : 70),
    maxLines: isStory ? 9 : 7,
    preferredFontSize: isStory ? 41 : 34,
    minimumFontSize: isStory ? 31 : 27,
    lineHeightRatio: 1.34,
    measure: (text, fontSize) => {
      setFont(context, fontSize, 600);
      return context.measureText(text).width;
    },
  });
  setFont(context, bodyFit.fontSize, 600);
  context.fillStyle = MUTED;
  drawLines(context, bodyFit.lines, margin, bodyTop, bodyFit.lineHeight);

  const ctaHeight = isStory ? 230 : 172;
  const ctaGradient = context.createLinearGradient(margin, ctaY, width - margin, ctaY + ctaHeight);
  ctaGradient.addColorStop(0, hexToRgba(content.accent, 0.28));
  ctaGradient.addColorStop(1, hexToRgba(content.accent, 0.12));
  context.fillStyle = ctaGradient;
  roundedRect(context, margin, ctaY, width - margin * 2, ctaHeight, isStory ? 36 : 30);
  context.fill();
  context.strokeStyle = hexToRgba(content.accent, 0.62);
  context.lineWidth = 2;
  roundedRect(context, margin, ctaY, width - margin * 2, ctaHeight, isStory ? 36 : 30);
  context.stroke();
  setFont(context, isStory ? 20 : 17, 800);
  context.fillStyle = content.accent;
  drawTrackingText(
    context,
    "PRÓXIMO PASSO",
    margin + (isStory ? 38 : 32),
    ctaY + (isStory ? 54 : 43),
    1.4,
  );
  const ctaFit = fitMeasuredText({
    text: content.cta,
    maxWidth: width - margin * 2 - (isStory ? 76 : 64),
    maxHeight: ctaHeight - (isStory ? 88 : 70),
    maxLines: 2,
    preferredFontSize: isStory ? 38 : 31,
    minimumFontSize: isStory ? 29 : 25,
    lineHeightRatio: 1.18,
    measure: (text, fontSize) => {
      setFont(context, fontSize, 700);
      return context.measureText(text).width;
    },
  });
  setFont(context, ctaFit.fontSize, 700);
  context.fillStyle = WHITE;
  drawLines(
    context,
    ctaFit.lines,
    margin + (isStory ? 38 : 32),
    ctaY + (isStory ? 112 : 91),
    ctaFit.lineHeight,
  );

  const footerY = isStory ? 1735 : 1212;
  context.fillStyle = hexToRgba(content.accent, 0.3);
  roundedRect(context, margin, footerY - 52, 220, 8, 4);
  context.fill();
  const footerNameFit = fitMeasuredText({
    text: content.displayName,
    maxWidth: isStory ? 520 : 470,
    maxHeight: isStory ? 40 : 34,
    maxLines: 1,
    preferredFontSize: isStory ? 32 : 28,
    minimumFontSize: isStory ? 23 : 20,
    lineHeightRatio: 1,
    measure: (text, fontSize) => {
      setFont(context, fontSize, 800, DISPLAY_STACK);
      return context.measureText(text).width;
    },
  });
  setFont(context, footerNameFit.fontSize, 800, DISPLAY_STACK);
  context.fillStyle = WHITE;
  context.fillText(footerNameFit.lines[0], margin, footerY);
  if (content.instagramHandle) {
    setFont(context, isStory ? 24 : 21, 600);
    context.fillStyle = MUTED;
    context.fillText(
      content.instagramHandle,
      margin,
      footerY + (isStory ? 42 : 36),
      isStory ? 520 : 470,
    );
  }
  context.textAlign = "right";
  setFont(context, isStory ? 18 : 15, 700);
  context.fillStyle = content.accent;
  context.fillText("INFORMAÇÃO QUE CUIDA", width - margin, footerY + (isStory ? 8 : 5));
  setFont(context, isStory ? 15 : 13, 600);
  context.fillStyle = hexToRgba(WHITE, 0.62);
  context.fillText(
    "CONTEÚDO EDUCATIVO · NÃO SUBSTITUI AVALIAÇÃO",
    width - margin,
    footerY + (isStory ? 42 : 35),
  );
  context.textAlign = "left";
}

export async function renderDailyPostCanvas(
  assignment: DailyPostAssignment,
  format: DailyPostExportFormat,
  variant?: DailyPostVariant | null,
  slideIndex?: number,
): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const dimensions = DAILY_POST_DIMENSIONS[format];
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu gerar a arte.");
  const content = resolveDailyPostRenderContent(assignment, variant);
  const assets = await prepareAssets(content);
  drawPremiumPost(context, assignment, format, variant, assets, slideIndex);
  return canvas;
}

export async function renderDailyPostPreviewDataUrl(
  assignment: DailyPostAssignment,
  format: DailyPostExportFormat,
  variant?: DailyPostVariant | null,
  slideIndex?: number,
): Promise<string> {
  const canvas = await renderDailyPostCanvas(assignment, format, variant, slideIndex);
  return canvas.toDataURL("image/png");
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Não foi possível finalizar a arte.")),
      "image/png",
    );
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export async function downloadDailyPostPng(
  assignment: DailyPostAssignment,
  format: DailyPostExportFormat,
  variant?: DailyPostVariant | null,
): Promise<void> {
  const canvas = await renderDailyPostCanvas(assignment, format, variant);
  const blob = await canvasBlob(canvas);
  triggerBlobDownload(
    blob,
    "post-do-dia-" + assignment.assignmentDate + "-" + format + ".png",
  );
}

export async function downloadDailyPostCarousel(
  assignment: DailyPostAssignment,
  variant?: DailyPostVariant | null,
): Promise<void> {
  const slides = assignment.contentSnapshot.carouselSlides ?? [];
  if (slides.length < 2) {
    throw new Error("Este conteúdo não possui páginas de carrossel.");
  }
  const entries = [];
  for (let index = 0; index < slides.length; index += 1) {
    const canvas = await renderDailyPostCanvas(assignment, "feed", variant, index);
    const blob = await canvasBlob(canvas);
    entries.push({
      name: String(index + 1).padStart(2, "0") + "-post-do-dia.png",
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  const zip = createStoredZip(entries);
  const zipBuffer = zip.buffer.slice(
    zip.byteOffset,
    zip.byteOffset + zip.byteLength,
  ) as ArrayBuffer;
  triggerBlobDownload(
    new Blob([zipBuffer], { type: "application/zip" }),
    "carrossel-post-do-dia-" + assignment.assignmentDate + ".zip",
  );
}

export async function uploadDailyPostImage(
  file: File,
  assignment: DailyPostAssignment,
): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 1080 || bitmap.height < 1080) {
    bitmap.close();
    throw new Error("A imagem precisa ter pelo menos 1080 × 1080 px.");
  }
  const maxSide = 2400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível preparar a imagem.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Não foi possível preparar a imagem.")),
      "image/webp",
      0.9,
    );
  });
  const target = ref(
    storage,
    "daily-posts/professionals/"
      + assignment.professionalId
      + "/"
      + assignment.id
      + "/custom-"
      + Date.now()
      + ".webp",
  );
  await uploadBytes(target, blob, {
    contentType: "image/webp",
    cacheControl: "private,max-age=31536000,immutable",
    customMetadata: { assignmentId: assignment.id },
  });
  return getDownloadURL(target);
}
