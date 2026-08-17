import React from "react";
import { Copy, Instagram } from "lucide-react";
import { DailyPost } from "../types";

export const DailyPostCard: React.FC<{ post?: DailyPost | null; compact?: boolean }> = ({ post, compact = false }) => {
  if (!post) return <article className="rounded-[2rem] border border-slate-100 bg-white p-7"><Instagram className="h-6 w-6 text-slate-300" /><h2 className="mt-4 text-xl font-black">Post do Dia</h2><p className="mt-2 text-sm font-medium text-slate-500">A Sorvy ainda não publicou o conteúdo de hoje.</p></article>;
  const content = `${post.caption}\n\n${post.cta}`;
  return <article className={`rounded-[2rem] bg-blue-600 text-white ${compact ? "p-7" : "p-8"}`}>
    <Instagram className="h-7 w-7" />
    <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-blue-100">Post do Dia</p>
    <h2 className="mt-2 text-2xl font-black">{post.title}</h2>
    {post.imageUrl && <img src={post.imageUrl} alt="Criativo do Post do Dia" className="mt-5 max-h-72 w-full rounded-2xl object-cover" referrerPolicy="no-referrer" />}
    <p className="mt-4 whitespace-pre-line text-sm font-medium leading-relaxed text-blue-50">{post.caption}</p>
    <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm font-black">{post.cta}</p>
    <button onClick={() => void navigator.clipboard.writeText(content)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-blue-700"><Copy className="h-4 w-4" />Copiar conteúdo</button>
  </article>;
};
