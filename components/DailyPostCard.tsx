import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  History,
  ImageIcon,
  Instagram,
  LoaderCircle,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { DailyPostAssignment, DailyPostVariant } from "../types";
import {
  downloadDailyPostCarousel,
  downloadDailyPostPng,
  renderDailyPostPreviewDataUrl,
  uploadDailyPostImage,
} from "../services/dailyPostImage";
import { DailyPostExportFormat } from "../services/dailyPostLayout";

type DailyPostEvent =
  | "view"
  | "customize"
  | "copy_caption"
  | "download_feed"
  | "download_story"
  | "mark_as_used"
  | "request_alternative";

interface Props {
  post?: DailyPostAssignment | null;
  history?: DailyPostAssignment[];
  compact?: boolean;
  readOnly?: boolean;
  onEvent?: (
    event: DailyPostEvent,
    format?: "feed" | "story" | "carousel" | "none",
    variant?: DailyPostVariant,
  ) => Promise<void>;
}

const categoryLabels: Record<string, string> = {
  prevention: "Prevenção",
  aesthetics: "Estética",
  orthodontics: "Ortodontia",
  implants: "Implantes e próteses",
  pediatric: "Odontopediatria",
  periodontics: "Saúde gengival",
  urgent_care: "Atenção e urgência",
};

const formatLabels: Record<string, string> = {
  single_card: "Card educativo",
  carousel: "Carrossel",
  qa: "Pergunta e resposta",
  myth_truth: "Mito ou verdade",
  checklist: "Checklist",
};

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40";

function templateKey(post?: DailyPostAssignment | null): string {
  return post
    ? post.id + ":" + post.templateId + ":" + post.alternativeCount
    : "empty";
}

export const DailyPostCard: React.FC<Props> = ({
  post,
  history = [],
  compact = false,
  readOnly = false,
  onEvent,
}) => {
  const currentTemplateKey = templateKey(post);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<DailyPostExportFormat>("feed");
  const [carouselSlide, setCarouselSlide] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [variantState, setVariantState] = useState<{
    key: string;
    value: DailyPostVariant | null;
  }>({
    key: currentTemplateKey,
    value: post?.customizedVariant ?? null,
  });

  const savedVariant =
    variantState.key === currentTemplateKey
      ? variantState.value
      : post?.customizedVariant ?? null;
  const carouselSlides = post?.contentSnapshot.carouselSlides ?? [];
  const isCarousel =
    post?.contentSnapshot.editorialFormat === "carousel"
    && carouselSlides.length > 1;

  const active = useMemo<DailyPostVariant | null>(() => {
    if (!post) return null;
    const content = post.contentSnapshot;
    const brand = post.brandSnapshot;
    return savedVariant ?? {
      title: content.title,
      caption: content.caption,
      ctaText: content.ctaText,
      imageUrl: content.defaultImageUrl,
      includeLogo: true,
      displayName: brand?.displayName ?? "",
      instagramHandle: brand?.instagramHandle ?? "",
      paletteKey: content.paletteKey,
    };
  }, [post, savedVariant]);

  const setVariant = (value: DailyPostVariant | null) => {
    setVariantState({ key: currentTemplateKey, value });
  };

  const emitEvent = async (
    event: DailyPostEvent,
    format?: "feed" | "story" | "carousel" | "none",
    variant?: DailyPostVariant,
  ): Promise<void> => {
    if (!onEvent) {
      throw new Error("A ação do Post do Dia não está disponível neste painel.");
    }
    await onEvent(event, format, variant);
  };

  useEffect(() => {
    setVariantState({
      key: currentTemplateKey,
      value: post?.customizedVariant ?? null,
    });
    setEditing(false);
    setCarouselSlide(0);
  }, [currentTemplateKey, post?.customizedVariant]);

  useEffect(() => {
    if (!post || readOnly || !onEvent) return;
    void emitEvent("view").catch(() => undefined);
    // Register one opening per assigned post. `onEvent` is recreated by the
    // parent after state updates, so depending on it here would create an
    // event loop and repeatedly mark the same post as viewed.
  }, [currentTemplateKey, readOnly]);

  useEffect(() => {
    if (!post || !active) {
      setPreviewUrl("");
      return;
    }
    let cancelled = false;
    setRenderingPreview(true);
    setPreviewError(null);
    const timeout = window.setTimeout(() => {
      void renderDailyPostPreviewDataUrl(
        post,
        previewFormat,
        active,
        isCarousel && previewFormat === "feed" ? carouselSlide : undefined,
      )
        .then((url) => {
          if (!cancelled) setPreviewUrl(url);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreviewError(
              error instanceof Error
                ? error.message
                : "Não foi possível gerar a prévia.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setRenderingPreview(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    currentTemplateKey,
    post,
    active,
    previewFormat,
    isCarousel,
    carouselSlide,
  ]);

  if (!post || !active) {
    return (
      <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
        <Instagram className="h-6 w-6 text-slate-300" />
        <h2 className="mt-4 text-xl font-black">Seu Post do Dia</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          A biblioteca ainda está sendo preparada para este perfil.
        </p>
      </article>
    );
  }

  const content = post.contentSnapshot;
  const hashtags = content.hashtags ?? [];
  const seoKeywords = content.seoKeywords ?? [];

  const act = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(null);
    }
  };

  const download = (format: DailyPostExportFormat) =>
    act("download-" + format, async () => {
      setPreviewFormat(format);
      await downloadDailyPostPng(post, format, active);
      await emitEvent(
        format === "feed" ? "download_feed" : "download_story",
        format,
      );
      setNotice(
        (format === "feed" ? "Feed" : "Story")
          + " baixado com o mesmo layout da prévia.",
      );
    });

  const downloadCarousel = () =>
    act("download-carousel", async () => {
      setPreviewFormat("feed");
      await downloadDailyPostCarousel(post, active);
      await emitEvent("download_feed", "carousel");
      setNotice(
        "Carrossel baixado em ZIP com "
          + carouselSlides.length
          + " imagens numeradas.",
      );
    });

  const copyCaption = () =>
    act("copy", async () => {
      const completeCaption = [
        active.caption.trim(),
        hashtags.join(" "),
      ].filter(Boolean).join("\n\n");
      await navigator.clipboard.writeText(completeCaption);
      await emitEvent("copy_caption");
      setNotice("Legenda completa, CTA e hashtags copiados.");
    });

  return (
    <div className="space-y-5">
      <article
        className={
          "overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm "
          + (compact ? "p-5 sm:p-6" : "p-5 sm:p-8")
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              <Sparkles className="h-4 w-4" />
              Curadoria odontológica para hoje
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Seu Post do Dia
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Conteúdo pronto para informar, gerar confiança e iniciar conversas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-50 px-3 py-2 text-[10px] font-black uppercase text-cyan-700">
              {categoryLabels[content.category]}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black uppercase text-slate-600">
              {formatLabels[content.editorialFormat]}
            </span>
          </div>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)]">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Arte final validada
                </p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  A prévia abaixo é o mesmo arquivo usado no download.
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {(["feed", "story"] as DailyPostExportFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setPreviewFormat(format)}
                    className={
                      "rounded-lg px-3 py-2 text-[10px] font-black uppercase transition "
                      + (previewFormat === format
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800")
                    }
                  >
                    {format === "feed" ? "Feed · 1080×1350" : "Story · 1080×1920"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[1.75rem] bg-slate-950 p-3 sm:p-5">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={"Prévia final do post: " + active.title}
                  className={
                    "max-h-[720px] w-auto max-w-full rounded-2xl object-contain shadow-2xl "
                    + (renderingPreview ? "opacity-60" : "opacity-100")
                  }
                />
              )}
              {(!previewUrl || renderingPreview) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45">
                  <p className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-xs font-black text-white backdrop-blur">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Validando composição e margens...
                  </p>
                </div>
              )}
            </div>
            {previewError && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {previewError}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
              <Check className="h-4 w-4" />
              Tipografia, margens e CTA ajustados para o formato selecionado.
            </div>
            {isCarousel && previewFormat === "feed" && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2">
                <button
                  type="button"
                  aria-label="Página anterior do carrossel"
                  disabled={carouselSlide === 0}
                  onClick={() => setCarouselSlide((value) => Math.max(0, value - 1))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  {carouselSlides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={"Ver página " + (index + 1)}
                      onClick={() => setCarouselSlide(index)}
                      className={
                        "h-2.5 rounded-full transition-all "
                        + (carouselSlide === index
                          ? "w-7 bg-blue-600"
                          : "w-2.5 bg-slate-300")
                      }
                    />
                  ))}
                  <span className="ml-2 text-[10px] font-black text-slate-500">
                    {carouselSlide + 1}/{carouselSlides.length}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Próxima página do carrossel"
                  disabled={carouselSlide === carouselSlides.length - 1}
                  onClick={() =>
                    setCarouselSlide((value) =>
                      Math.min(carouselSlides.length - 1, value + 1),
                    )
                  }
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
              Legenda pronta para publicar
            </p>
            <h3 className="mt-3 text-2xl font-black leading-tight text-slate-950">
              {active.title}
            </h3>
            <div className="mt-5 max-h-[430px] overflow-y-auto pr-2">
              <p className="whitespace-pre-line text-sm font-medium leading-7 text-slate-600">
                {active.caption}
              </p>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  SEO social
                </p>
              </div>
              {seoKeywords.length > 0 && (
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-600">
                  {seoKeywords.join(" · ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {hashtags.map((hashtag) => (
                  <span
                    key={hashtag}
                    className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-blue-700 shadow-sm"
                  >
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        {!readOnly && (
          <div className="mt-7 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setEditing(true)}
              className={buttonClass}
            >
              <Palette className="h-4 w-4" />
              Personalizar
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void copyCaption()}
              className={buttonClass}
            >
              {busy === "copy" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copiar legenda + SEO
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || Boolean(previewError)}
              onClick={() =>
                void (isCarousel ? downloadCarousel() : download("feed"))
              }
              className={buttonClass}
            >
              {busy === "download-feed" || busy === "download-carousel" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isCarousel
                ? "Baixar carrossel (" + carouselSlides.length + ")"
                : "Baixar Feed"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || Boolean(previewError)}
              onClick={() => void download("story")}
              className={buttonClass}
            >
              {busy === "download-story" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Baixar Story
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("used", async () => {
                  await emitEvent("mark_as_used");
                  setNotice("Conteúdo marcado como utilizado.");
                })
              }
              className={buttonClass}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar como utilizado
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("alternative", async () => {
                  await emitEvent("request_alternative");
                  setNotice("Nova opção carregada com sucesso.");
                })
              }
              className={buttonClass}
            >
              {busy === "alternative" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Ver outra opção
            </button>
          </div>
        )}

        {notice && (
          <p
            aria-live="polite"
            className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800"
          >
            {notice}
          </p>
        )}
      </article>

      <article className="rounded-[2rem] border border-slate-100 bg-white p-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <h3 className="font-black">Histórico recente</h3>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {history.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-black">
                {item.contentSnapshot.title}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                {item.assignmentDate} · {item.status}
              </p>
            </div>
          ))}
        </div>
      </article>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-7 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  Personalização exclusiva deste post
                </p>
                <h3 className="mt-1 text-2xl font-black">Ajustar conteúdo e marca</h3>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  A arte é revalidada automaticamente enquanto você edita.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar personalização"
                onClick={() => setEditing(false)}
                className="h-fit rounded-xl bg-slate-100 p-3 text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-black uppercase text-slate-500">
                Título
                <input
                  className="input mt-2"
                  value={active.title}
                  maxLength={120}
                  onChange={(event) =>
                    setVariant({ ...active, title: event.target.value })
                  }
                  placeholder="Título"
                />
              </label>
              <label className="block text-xs font-black uppercase text-slate-500">
                Legenda
                <textarea
                  className="input mt-2"
                  rows={8}
                  value={active.caption}
                  maxLength={2200}
                  onChange={(event) =>
                    setVariant({ ...active, caption: event.target.value })
                  }
                />
              </label>
              <label className="block text-xs font-black uppercase text-slate-500">
                Chamada para ação
                <input
                  className="input mt-2"
                  value={active.ctaText}
                  maxLength={160}
                  onChange={(event) =>
                    setVariant({ ...active, ctaText: event.target.value })
                  }
                  placeholder="CTA"
                />
              </label>
              <label className="block text-xs font-black uppercase text-slate-500">
                Imagem aprovada
                <input
                  className="input mt-2"
                  value={active.imageUrl}
                  onChange={(event) =>
                    setVariant({ ...active, imageUrl: event.target.value })
                  }
                  placeholder="URL https opcional"
                />
              </label>
              <label className="block rounded-xl border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-600">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Enviar imagem própria (JPG, PNG ou WebP)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-3 block w-full text-xs"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void act("upload", async () => {
                        const imageUrl = await uploadDailyPostImage(file, post);
                        setVariant({ ...active, imageUrl });
                      });
                    }
                  }}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-black uppercase text-slate-500">
                  Clínica ou profissional
                  <input
                    className="input mt-2"
                    value={active.displayName}
                    maxLength={120}
                    onChange={(event) =>
                      setVariant({ ...active, displayName: event.target.value })
                    }
                    placeholder="Nome da marca"
                  />
                </label>
                <label className="block text-xs font-black uppercase text-slate-500">
                  Instagram
                  <input
                    className="input mt-2"
                    value={active.instagramHandle}
                    maxLength={80}
                    onChange={(event) =>
                      setVariant({
                        ...active,
                        instagramHandle: event.target.value,
                      })
                    }
                    placeholder="@instagram"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold">
                  <input
                    type="color"
                    value={active.paletteKey}
                    onChange={(event) =>
                      setVariant({ ...active, paletteKey: event.target.value })
                    }
                  />
                  Cor de destaque
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={active.includeLogo}
                    onChange={(event) =>
                      setVariant({ ...active, includeLogo: event.target.checked })
                    }
                  />
                  Exibir logo cadastrada
                </label>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setVariant(null)}
                className="rounded-xl border border-slate-200 py-4 text-xs font-black uppercase tracking-widest text-slate-600"
              >
                Restaurar proposta
              </button>
              <button
                type="button"
                disabled={
                  Boolean(busy)
                  || active.title.trim().length < 3
                  || active.caption.trim().length < 10
                  || active.ctaText.trim().length < 3
                }
                onClick={() =>
                  void act("customize", async () => {
                    await emitEvent("customize", "none", active);
                    setVariant(active);
                    setEditing(false);
                    setNotice("Personalização salva somente neste post.");
                  })
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40"
              >
                {busy === "customize" ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                Salvar personalização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
