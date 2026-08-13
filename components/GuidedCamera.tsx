import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  FaceLandmarker,
  FaceLandmarkerResult,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import {
  averageFrameBrightness,
  CameraGuidance,
  evaluateCameraFrame,
} from "../services/cameraGuidance";

const READY_HOLD_MS = 1_200;
const FRAME_INTERVAL_MS = 140;
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const initialGuidance: CameraGuidance = {
  code: "no-face",
  message: "Posicione seu rosto dentro do contorno",
  ready: false,
};

function categoryScore(
  result: FaceLandmarkerResult,
  categoryName: string,
): number {
  const category = result.faceBlendshapes[0]?.categories.find(
    (item) => item.categoryName === categoryName,
  );
  return category?.score ?? 0;
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") {
    return "A câmera não foi autorizada. Você ainda pode escolher uma foto do aparelho.";
  }
  if (name === "NotFoundError") {
    return "Nenhuma câmera foi encontrada. Escolha uma foto do aparelho.";
  }
  return "Não foi possível iniciar a câmera guiada. Escolha uma foto do aparelho.";
}

export const GuidedCamera = ({
  onCapture,
  onCancel,
  onChoosePhoto,
}: {
  onCapture: (file: File) => Promise<void>;
  onCancel: () => void;
  onChoosePhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousFaceRef = useRef<{ x: number; y: number; width: number } | null>(null);
  const readySinceRef = useRef<number | null>(null);
  const captureStartedRef = useRef(false);
  const lastFrameRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [trackerAvailable, setTrackerAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState(initialGuidance);
  const [progress, setProgress] = useState(0);

  const stopCamera = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  const captureFrame = useCallback(async () => {
    if (captureStartedRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    captureStartedRef.current = true;
    setCapturing(true);

    try {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const sourceX = (video.videoWidth - size) / 2;
      const sourceY = (video.videoHeight - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1600, size);
      canvas.height = canvas.width;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível.");
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(
        video,
        sourceX,
        sourceY,
        size,
        size,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("Foto vazia.")),
          "image/jpeg",
          0.9,
        );
      });
      stopCamera();
      await onCapture(new File([blob], "sorvy-smile-camera.jpg", {
        type: "image/jpeg",
      }));
    } catch {
      captureStartedRef.current = false;
      setCapturing(false);
      setError("Não foi possível capturar a foto. Tente novamente ou escolha uma imagem.");
    }
  }, [onCapture, stopCamera]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setLoading(false);

        try {
          const vision = await FilesetResolver.forVisionTasks(
            MEDIAPIPE_WASM_URL,
          );
          landmarkerRef.current = await FaceLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath: FACE_LANDMARKER_MODEL_URL,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              numFaces: 1,
              minFaceDetectionConfidence: 0.55,
              minFacePresenceConfidence: 0.55,
              minTrackingConfidence: 0.55,
              outputFaceBlendshapes: true,
            },
          );
        } catch {
          if (!cancelled) {
            setTrackerAvailable(false);
            setGuidance({
              code: "no-face",
              message: "Use o contorno e capture quando estiver pronto",
              ready: false,
            });
          }
        }

        const inspectFrame = (timestamp: number) => {
          if (cancelled || captureStartedRef.current) return;
          animationRef.current = window.requestAnimationFrame(inspectFrame);
          if (
            timestamp - lastFrameRef.current < FRAME_INTERVAL_MS
            || !videoRef.current
            || !analysisCanvasRef.current
            || !landmarkerRef.current
            || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            return;
          }
          lastFrameRef.current = timestamp;

          try {
            const result = landmarkerRef.current.detectForVideo(
              videoRef.current,
              timestamp,
            );
            const landmarks = result.faceLandmarks[0] ?? null;
            const canvas = analysisCanvasRef.current;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            let brightness = 128;
            if (context) {
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              brightness = averageFrameBrightness(
                context.getImageData(0, 0, canvas.width, canvas.height).data,
              );
            }

            let motion = 0;
            if (landmarks) {
              const xs = landmarks.map((point) => point.x);
              const ys = landmarks.map((point) => point.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);
              const currentFace = {
                x: minX + (maxX - minX) / 2,
                y: minY + (maxY - minY) / 2,
                width: maxX - minX,
              };
              const previous = previousFaceRef.current;
              if (previous) {
                motion =
                  Math.abs(currentFace.x - previous.x)
                  + Math.abs(currentFace.y - previous.y)
                  + Math.abs(currentFace.width - previous.width);
              }
              previousFaceRef.current = currentFace;
            }

            const nextGuidance = evaluateCameraFrame({
              landmarks,
              brightness,
              motion,
              jawOpen: categoryScore(result, "jawOpen"),
              smile: Math.max(
                categoryScore(result, "mouthSmileLeft"),
                categoryScore(result, "mouthSmileRight"),
              ),
            });
            setGuidance(nextGuidance);

            if (!nextGuidance.ready) {
              readySinceRef.current = null;
              setProgress(0);
              return;
            }
            readySinceRef.current ??= timestamp;
            const readyProgress = Math.min(
              1,
              (timestamp - readySinceRef.current) / READY_HOLD_MS,
            );
            setProgress(readyProgress);
            if (readyProgress >= 1) void captureFrame();
          } catch {
            setTrackerAvailable(false);
          }
        };
        animationRef.current = window.requestAnimationFrame(inspectFrame);
      } catch (cameraError) {
        if (!cancelled) {
          setError(cameraErrorMessage(cameraError));
          setLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [captureFrame, stopCamera]);

  return (
    <main className="mx-auto max-w-xl px-5 py-7">
      <button
        onClick={() => {
          stopCamera();
          onCancel();
        }}
        className="mb-5 flex items-center gap-2 text-sm font-black text-slate-500"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
          Foto guiada · etapa 1 de 4
        </p>
        <h1 className="mt-2 text-3xl font-black">Enquadre seu sorriso</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          O guia funciona no seu aparelho. Nenhum quadro do vídeo é enviado ou salvo.
        </p>
      </div>

      <section className="relative mt-6 aspect-[3/4] overflow-hidden rounded-[2.5rem] bg-slate-950 shadow-2xl">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
        <canvas ref={analysisCanvasRef} width={48} height={48} className="hidden" />
        <div
          className={`pointer-events-none absolute inset-[12%] rounded-[45%] border-[3px] transition-colors ${
            guidance.ready
              ? "border-emerald-400 shadow-[0_0_0_999px_rgba(2,6,23,0.18)]"
              : "border-white/70 shadow-[0_0_0_999px_rgba(2,6,23,0.30)]"
          }`}
        />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white">
            <LoaderCircle className="h-11 w-11 animate-spin text-blue-400" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest">
              Preparando câmera
            </p>
          </div>
        )}
        {capturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest">
              Foto capturada
            </p>
          </div>
        )}
        {!loading && !error && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-slate-950/80 p-4 text-center text-white backdrop-blur-md">
            <p className="text-sm font-black">{guidance.message}</p>
            {guidance.ready && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          {error}
        </div>
      )}

      {!loading && !trackerAvailable && !error && (
        <button
          disabled={capturing}
          onClick={() => void captureFrame()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white"
        >
          <Camera className="h-5 w-5" /> Capturar agora
        </button>
      )}

      <label className="relative mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600">
        <ImagePlus className="h-5 w-5" /> Escolher uma foto
        <input
          type="file"
          accept="image/*"
          capture="user"
          onChange={onChoosePhoto}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        O Gemini só recebe a foto depois da sua confirmação.
      </p>
    </main>
  );
};
