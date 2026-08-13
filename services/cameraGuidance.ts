export interface FacePoint {
  x: number;
  y: number;
  z?: number;
}

export interface CameraFrameSignals {
  landmarks: FacePoint[] | null;
  brightness: number;
  motion: number;
  jawOpen: number;
  smile: number;
}

export interface SmileRegion {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface SmileCropRect {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export type CameraGuidanceCode =
  | "no-face"
  | "center"
  | "closer"
  | "farther"
  | "straighten"
  | "dark"
  | "bright"
  | "smile"
  | "steady"
  | "ready";

export interface CameraGuidance {
  code: CameraGuidanceCode;
  message: string;
  ready: boolean;
}

const guidance = (
  code: CameraGuidanceCode,
  message: string,
  ready = false,
): CameraGuidance => ({ code, message, ready });

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export function smileRegionFromLandmarks(
  landmarks: FacePoint[] | null,
): SmileRegion | null {
  if (!landmarks || landmarks.length <= 291) return null;
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  if (!leftCorner || !rightCorner || !upperLip || !lowerLip) return null;

  return {
    centerX: (leftCorner.x + rightCorner.x) / 2,
    centerY: (upperLip.y + lowerLip.y) / 2,
    width: Math.abs(rightCorner.x - leftCorner.x),
    height: Math.abs(lowerLip.y - upperLip.y),
  };
}

export function smileCropRect(
  videoWidth: number,
  videoHeight: number,
  region: SmileRegion | null,
): SmileCropRect {
  const safeWidth = Math.max(1, videoWidth);
  const safeHeight = Math.max(1, videoHeight);
  const centerX = (region?.centerX ?? 0.5) * safeWidth;
  const centerY = (region?.centerY ?? 0.58) * safeHeight;
  let sourceWidth = clamp(
    (region?.width ?? 0.24) * safeWidth * 2.25,
    safeWidth * 0.44,
    safeWidth * 0.82,
  );
  let sourceHeight = sourceWidth * 2 / 3;
  if (sourceHeight > safeHeight * 0.68) {
    sourceHeight = safeHeight * 0.68;
    sourceWidth = sourceHeight * 3 / 2;
  }

  return {
    sourceX: clamp(centerX - sourceWidth / 2, 0, safeWidth - sourceWidth),
    sourceY: clamp(centerY - sourceHeight / 2, 0, safeHeight - sourceHeight),
    sourceWidth,
    sourceHeight,
  };
}

export function evaluateCameraFrame(
  signals: CameraFrameSignals,
): CameraGuidance {
  const landmarks = signals.landmarks;
  if (!landmarks || landmarks.length < 264) {
    return guidance("no-face", "Posicione seu sorriso dentro da moldura");
  }

  const smileRegion = smileRegionFromLandmarks(landmarks);
  if (!smileRegion) {
    return guidance("no-face", "Mostre seu sorriso para a câmera");
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (
    Math.abs(smileRegion.centerX - 0.5) > 0.11
    || Math.abs(smileRegion.centerY - 0.58) > 0.14
  ) {
    return guidance("center", "Centralize sua boca na moldura");
  }
  if (smileRegion.width < 0.16 || width < 0.36 || height < 0.44) {
    return guidance("closer", "Aproxime o sorriso da câmera");
  }
  if (smileRegion.width > 0.46 || width > 0.82 || height > 0.92) {
    return guidance("farther", "Afaste um pouco o celular");
  }

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const eyeAngle = Math.atan2(
    rightEye.y - leftEye.y,
    rightEye.x - leftEye.x,
  );
  if (Math.abs(eyeAngle) > 0.12) {
    return guidance("straighten", "Deixe o celular mais reto");
  }
  if (signals.brightness < 68) {
    return guidance("dark", "Procure uma luz de frente para você");
  }
  if (signals.brightness > 225) {
    return guidance("bright", "Evite a luz forte diretamente no rosto");
  }
  if (signals.jawOpen < 0.08 && signals.smile < 0.16) {
    return guidance("smile", "Sorria mostrando os dentes");
  }
  if (signals.motion > 0.022) {
    return guidance("steady", "Mantenha o celular firme");
  }
  return guidance("ready", "Perfeito — mantenha assim", true);
}

export function averageFrameBrightness(
  pixels: Uint8ClampedArray,
): number {
  if (pixels.length < 4) return 0;
  let total = 0;
  let samples = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    total +=
      pixels[index] * 0.2126
      + pixels[index + 1] * 0.7152
      + pixels[index + 2] * 0.0722;
    samples += 1;
  }
  return samples ? total / samples : 0;
}
