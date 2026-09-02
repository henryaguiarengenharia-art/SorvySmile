import React from "react";

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("APP_RUNTIME_ERROR", {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <section className="w-full max-w-lg rounded-[2.5rem] border border-slate-100 bg-white p-9 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Sorvy Smile</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Não foi possível exibir esta tela.</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
            Seus dados não foram apagados. Recarregue a página para restabelecer a conexão.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black text-white hover:bg-blue-700">
              Recarregar
            </button>
            <a href="/" className="rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black text-slate-700 hover:border-blue-300 hover:text-blue-700">
              Ir para o início
            </a>
          </div>
        </section>
      </main>
    );
  }
}
