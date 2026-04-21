import React from 'react';
import { Sparkles, Zap, Trophy, Target, TrendingUp, Users } from 'lucide-react';

export const StrategyOnePager: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-white shadow-2xl rounded-[3rem] my-8 space-y-12 text-slate-800 border border-slate-100 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Smile className="w-64 h-64" />
      </div>

      <header className="border-b pb-10">
        <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6">
          Strategic Roadmap 2026
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tighter">Sorvy Smile <span className="text-blue-600">Growth</span></h1>
        <p className="text-2xl text-slate-400 font-medium italic">"Maximizando o ROI Clínico via Inteligência de Triagem"</p>
      </header>

      <section className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3 text-blue-600">
            <Target className="w-6 h-6" /> Alavancas de Conversão
          </h2>
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <h3 className="font-black text-slate-800 mb-3 flex items-center gap-2">
              <Zap className="text-yellow-500 w-5 h-5 fill-yellow-500" /> The Curiosity Gap
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Ao ocultar as observações detalhadas até o preenchimento do lead, exploramos o viés cognitivo da <strong>aversão à perda</strong>. O usuário já investiu tempo na foto e no score inicial, tornando o formulário um "pedágio" de baixo atrito.
            </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <h3 className="font-black text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="text-blue-600 w-5 h-5" /> Social Benchmarking
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Transformamos um dado clínico em um "ranking". Isso remove o estigma de "ir ao dentista" e o substitui pelo desejo de "otimizar o score", similar a apps de fitness (gamificação).
            </p>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <TrendingUp className="text-green-400 w-6 h-6" /> Business Model
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-white/10 p-3 rounded-2xl h-fit"><Users className="text-blue-400 w-6 h-6" /></div>
                <div>
                  <h4 className="font-black text-lg">Qualificação Premium</h4>
                  <p className="text-xs text-white/60 font-medium">A clínica não recebe apenas um "oi", recebe um resumo qualificado com scores e intenção de serviço mapeada.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/10 p-3 rounded-2xl h-fit"><Sparkles className="text-yellow-400 w-6 h-6" /></div>
                <div>
                  <h4 className="font-black text-lg">Scarcity Principle</h4>
                  <p className="text-xs text-white/60 font-medium">O laudo é descartado em seguida (LGPD), criando uma janela de oportunidade única para o agendamento imediato.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Revenue Target</p>
            <p className="text-xl font-black text-green-400">Increase LTV by 22%</p>
          </div>
        </div>
      </section>

      <footer className="pt-10 border-t flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Powered by Sorvy Smile AI</p>
        <div className="flex gap-4">
          <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black text-xs">V2.0 LIVE (2026)</div>
          <div className="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl font-black text-xs italic">LGPD COMPLIANT</div>
        </div>
      </footer>
    </div>
  );
};

// Internal icon proxy for clean Strategy file
const Smile = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);