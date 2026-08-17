import React, { useState } from "react";
import { CalendarClock, Edit3, LoaderCircle, Plus, Send } from "lucide-react";
import { DailyPost, DailyPostStatus } from "../types";

interface DailyPostManagerProps {
  posts: DailyPost[];
  onSave: (input: { postId?: string; title: string; caption: string; cta: string; imageUrl?: string; status: DailyPostStatus; publishAtMs?: number | null; expiresAtMs?: number | null }) => Promise<unknown>;
}

const toInputDate = (value?: number) => value ? new Date(value - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

export const DailyPostManager: React.FC<DailyPostManagerProps> = ({ posts, onSave }) => {
  const [postId, setPostId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<DailyPostStatus>("draft");
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reset = () => { setPostId(undefined); setTitle(""); setCaption(""); setCta(""); setImageUrl(""); setStatus("draft"); setPublishAt(""); setExpiresAt(""); };
  const edit = (post: DailyPost) => { setPostId(post.id); setTitle(post.title); setCaption(post.caption); setCta(post.cta); setImageUrl(post.imageUrl ?? ""); setStatus(post.status); setPublishAt(toInputDate(post.publishAt)); setExpiresAt(toInputDate(post.expiresAt)); };
  const save = async () => {
    if (status === "scheduled" && !publishAt) {
      setNotice("Informe quando o conteúdo deve ser publicado.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      await onSave({ postId, title, caption, cta, imageUrl, status, publishAtMs: publishAt ? new Date(publishAt).getTime() : null, expiresAtMs: expiresAt ? new Date(expiresAt).getTime() : null });
      setNotice(status === "published" ? "Post publicado." : status === "scheduled" ? "Post programado." : "Post salvo.");
      reset();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar o post."); }
    finally { setBusy(false); }
  };

  return <section className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
    <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Conteúdo central</p><h2 className="mt-1 text-2xl font-black">{postId ? "Editar Post do Dia" : "Novo Post do Dia"}</h2></div>{postId && <button onClick={reset} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black"><Plus className="h-4 w-4" /></button>}</div>
      <div className="mt-6 space-y-4"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="input" /><textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={6} placeholder="Legenda completa" className="input resize-none" /><textarea value={cta} onChange={(event) => setCta(event.target.value)} rows={3} placeholder="CTA" className="input resize-none" /><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="URL https da imagem (opcional)" className="input" /><div className="grid gap-4 sm:grid-cols-3"><select value={status} onChange={(event) => setStatus(event.target.value as DailyPostStatus)} className="input"><option value="draft">Rascunho</option><option value="scheduled">Programado</option><option value="published">Publicado</option><option value="inactive">Inativo</option></select><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-400">Publicar em</span><input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className="input" /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-400">Expirar em</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="input" /></label></div></div>
      <button disabled={busy || title.trim().length < 3 || caption.trim().length < 10 || cta.trim().length < 3 || (status === "scheduled" && !publishAt)} onClick={() => void save()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : status === "scheduled" ? <CalendarClock className="h-5 w-5" /> : <Send className="h-5 w-5" />}Salvar conteúdo</button>
      {notice && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">{notice}</p>}
    </article>
    <article className="rounded-[2rem] border border-slate-100 bg-white p-7"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico</p><h2 className="mt-1 text-2xl font-black">Publicações</h2><div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto">{posts.map((post) => <button key={post.id} onClick={() => edit(post)} className="flex w-full items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 text-left"><div><p className="font-black">{post.title}</p><p className="mt-1 text-xs font-bold text-slate-400">{post.status} · {new Date(post.updatedAt).toLocaleString("pt-BR")}</p></div><Edit3 className="h-4 w-4 text-blue-600" /></button>)}{posts.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhum conteúdo criado.</p>}</div></article>
  </section>;
};
