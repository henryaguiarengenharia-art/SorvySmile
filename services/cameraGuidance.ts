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

export function evaluateCameraFrame(
  signals: CameraFrameSignals,
): CameraGuidance {
  const landmarks = signals.landmarks;
  if (!landmarks || landmarks.length < 264) {
    return guidance("no-face", "Posicione seu rosto dentro do contorno");
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
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  if (Math.abs(centerX - 0.5) > 0.1 || Math.abs(centerY - 0.48) > 0.13) {
    return guidance("center", "Centralize seu rosto");
  }
  if (width < 0.34 || height < 0.42) {
    return guidance("closer", "Aproxime um pouco o celular");
  }
  if (width > 0.76 || height > 0.88) {
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

