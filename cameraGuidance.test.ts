import { describe, expect, it } from "vitest";
import {
  averageFrameBrightness,
  evaluateCameraFrame,
  FacePoint,
  smileCropRect,
  smileRegionFromLandmarks,
} from "./services/cameraGuidance";

const face = (
  minX = 0.25,
  maxX = 0.75,
  minY = 0.1,
  maxY = 0.84,
): FacePoint[] => {
  const points = Array.from({ length: 478 }, (_, index) => ({
    x: index % 2 ? maxX : minX,
    y: index % 3 ? maxY : minY,
  }));
  points[33] = { x: 0.36, y: 0.38 };
  points[263] = { x: 0.64, y: 0.38 };
  points[61] = { x: 0.39, y: 0.58 };
  points[291] = { x: 0.61, y: 0.58 };
  points[13] = { x: 0.5, y: 0.55 };
  points[14] = { x: 0.5, y: 0.61 };
  return points;
};

describe("orientação local da câmera", () => {
  it("pede para centralizar quando não há rosto", () => {
    expect(
      evaluateCameraFrame({
        landmarks: null,
        brightness: 120,
        motion: 0,
        jawOpen: 0.2,
        smile: 0.3,
      }).code,
    ).toBe("no-face");
  });

  it("orienta a iluminação antes de liberar a captura", () => {
    expect(
      evaluateCameraFrame({
        landmarks: face(),
        brightness: 35,
        motion: 0,
        jawOpen: 0.2,
        smile: 0.3,
      }).code,
    ).toBe("dark");
  });

  it("libera a captura quando enquadramento e sorriso estão adequados", () => {
    expect(
      evaluateCameraFrame({
        landmarks: face(),
        brightness: 130,
        motion: 0.005,
        jawOpen: 0.2,
        smile: 0.3,
      }),
    ).toMatchObject({ code: "ready", ready: true });
  });

  it("orienta pela posição da boca, mesmo quando o rosto parece centralizado", () => {
    const landmarks = face();
    landmarks[61] = { x: 0.18, y: 0.58 };
    landmarks[291] = { x: 0.38, y: 0.58 };
    landmarks[13] = { x: 0.28, y: 0.55 };
    landmarks[14] = { x: 0.28, y: 0.61 };

    expect(
      evaluateCameraFrame({
        landmarks,
        brightness: 130,
        motion: 0.005,
        jawOpen: 0.2,
        smile: 0.3,
      }).code,
    ).toBe("center");
  });

  it("localiza a boca e produz um recorte horizontal centrado no sorriso", () => {
    const region = smileRegionFromLandmarks(face());
    expect(region?.centerX).toBeCloseTo(0.5);
    expect(region?.centerY).toBeCloseTo(0.58);

    const crop = smileCropRect(720, 1280, region);
    expect(Math.round(crop.sourceWidth / crop.sourceHeight * 10) / 10).toBe(1.5);
    expect(crop.sourceX).toBeGreaterThanOrEqual(0);
    expect(crop.sourceY).toBeGreaterThanOrEqual(0);
    expect(crop.sourceX + crop.sourceWidth).toBeLessThanOrEqual(720);
    expect(crop.sourceY + crop.sourceHeight).toBeLessThanOrEqual(1280);
  });

  it("mantém o recorte do sorriso dentro de um vídeo horizontal", () => {
    const crop = smileCropRect(1280, 720, {
      centerX: 0.95,
      centerY: 0.78,
      width: 0.3,
      height: 0.08,
    });

    expect(crop.sourceX + crop.sourceWidth).toBeLessThanOrEqual(1280);
    expect(crop.sourceY + crop.sourceHeight).toBeLessThanOrEqual(720);
    expect(crop.sourceWidth / crop.sourceHeight).toBeCloseTo(1.5);
  });

  it("calcula a luminosidade média da imagem", () => {
    const pixels = new Uint8ClampedArray([
      100, 100, 100, 255,
      200, 200, 200, 255,
      100, 100, 100, 255,
      200, 200, 200, 255,
      100, 100, 100, 255,
    ]);
    expect(Math.round(averageFrameBrightness(pixels))).toBe(100);
  });
});
