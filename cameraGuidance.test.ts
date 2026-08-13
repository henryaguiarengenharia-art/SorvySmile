import { describe, expect, it } from "vitest";
import {
  averageFrameBrightness,
  evaluateCameraFrame,
  FacePoint,
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

