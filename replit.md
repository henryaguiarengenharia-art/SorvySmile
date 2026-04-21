# Sorvy Smile - Triagem Odontológica Digital

## Overview
AI-powered dental screening and instant clinic matching application. Built with React, Vite, TypeScript, and Tailwind CSS (PostCSS). Uses Google Gemini AI for dental photo analysis.

## Project Architecture
- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v3 (PostCSS) + tailwindcss-animate + tailwind-scrollbar
- **AI**: Google Gemini API (`@google/genai`) for smile analysis and photo validation
- **State**: localStorage-based persistence
- **Port**: 5000 (dev server)

## Project Structure
```
/
├── index.html          # Entry HTML (with meta tags, favicon, OG tags)
├── index.tsx           # React entry point (imports index.css)
├── index.css           # Tailwind CSS directives + no-scrollbar utility
├── App.tsx             # Main app component (all views)
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration (port 5000, host 0.0.0.0)
├── vite-env.d.ts       # Vite environment type declarations
├── tailwind.config.js  # Tailwind v3 config with plugins
├── postcss.config.js   # PostCSS config (tailwindcss + autoprefixer)
├── tsconfig.json       # TypeScript configuration (strict mode)
├── services/
│   └── geminiService.ts  # Gemini AI integration
├── components/
│   ├── AdminDashboardView.tsx
│   ├── DentistPortalView.tsx
│   ├── HQDashboardView.tsx
│   └── StrategyOnePager.tsx
└── package.json
```

## Environment Variables
- `API_KEY` - Google Gemini API key (injected via Vite define)

## Key Behaviors
- **Public landing**: App starts at landing (no login required) with top nav: "Como funciona | Planos | Acesso Pro | Admin"
- **Login on demand**: LoginView is shown only when user clicks "Acesso Pro" or "Admin" — never blocks public access
- **Patient routing logic**:
  - With Bio Link (`?d=slug` or `?c=slug`) → triagem → goes direct to that specific dentist/clinic via WhatsApp
  - Without referral context → triagem → `network-list` view (grid of all active dentists with city filter), patient picks one → opens WhatsApp
- **DEV MODE bar**: Fixed bottom nav bar visible only in development (`import.meta.env.DEV`). Allows navigating between all views without going through the normal user flow
- **Demo data**: Auto-generated seed data on first load via localStorage
- **Checkout**: PIX payment simulation — opens WhatsApp with plan details
- **AI Analysis**: Gemini `gemini-2.0-flash` model analyzes smile photos

## Login Credentials (Pilot)
Three distinct user roles drive routing via `DentistRecord.role: 'hq' | 'clinic' | 'dentist'`:
- **App Owner (HQ)** → `role: 'hq'` (hardcoded): `admin@sorvy.com.br` / `sorvy@hq2026` → hq-dashboard
- **Clínica** → `role: 'clinic'` (criada via checkout do plano **Network**): email do checkout + `sorvy123` → admin-dashboard
- **Dentista** → `role: 'dentist'` (criada via checkout do plano **Lite/Pro**, ou cadastrada por uma clínica via Admin Dashboard): email + `sorvy123` → dentist-portal
- **Paciente**: nenhum login necessário; público por padrão
- `handleLogout()` reseta `currentDentistId` e volta ao landing

## Build Status
- **TypeScript**: 0 errors (strict mode with noUnusedLocals + noUnusedParameters)
- **Production build**: `npm run build` — passes cleanly, ~657KB JS gzip 161KB
- **Deployment**: Static deployment (build: `npm run build`, public_dir: `dist`)

## Recent Changes
- Removed Tailwind CDN, migrated to Tailwind v3 PostCSS pipeline
- Fixed all 85+ TypeScript unused import errors across App.tsx, AdminDashboardView, DentistPortalView, HQDashboardView
- DEV MODE navigation bar gated behind `import.meta.env.DEV` (hidden in production)
- Added `vite-env.d.ts` for `import.meta.env` TypeScript types
- Added favicon, meta description, OG tags to index.html
- Added `import './index.css'` to index.tsx for Tailwind PostCSS
- Fixed HQDashboardView: removed unused destructured props, fixed unused `tempUpgrade` state
- **Checkout Flow Refactor (Sorvy Nutri model):**
  - **Passo 1** (`checkout-pix`): Formulário de cadastro — Nome, Email, WhatsApp, Especialidade + aceite dos Termos. Ao avançar, cria a conta como `status: 'pending'` no localStorage imediatamente.
  - **Passo 2** (`checkout-confirm`): Tela de pagamento — card escuro com resumo do plano (capacidade de leads + profundidade IA) + botão "Pagar Assinatura Agora" (link externo configurável por plano em `PAYMENT_LINKS`) + botão "Já Paguei! Enviar Comprovante" que abre WhatsApp para o admin com mensagem pré-preenchida.
  - **`checkout-done`**: Tela "Aguardando Ativação" (ícone âmbar + 3 passos explicativos) — remove a mentira de "Tudo pronto!".
  - **`ADMIN_WHATSAPP`** e **`PAYMENT_LINKS`**: constantes configuráveis no topo de App.tsx por plano (lite/pro/network).
  - **HQDashboardView `handleApprove`**: agora também ativa o `DentistRecord` (`isActive: true`) além do `BillingAccount` ao aprovar conta pendente.
  - Indicador de progresso 2 passos (Cadastro → Pagamento) visível em ambas as telas.
- **Login System + Phone Formatting:**
  - `GatekeeperView` replaced by `LoginView` — dark full-screen form with email + senha
  - 3 login paths: App Owner (hardcoded `ADMIN_EMAIL`/`ADMIN_PASSWORD` → hq-dashboard), Dentist/Clínica (email do checkout + `DENTIST_PILOT_PASSWORD = 'sorvy123'` → dentist-portal ou admin-dashboard), Paciente (bypass via "Sou paciente" button ou Bio Link URL params)
  - Error states: `wrong_credentials`, `pending` (conta aguardando ativação), `inactive`
  - `handleLogout()` resets auth state; "SAIR" button added to DEV bar
  - Bio Link auto-auth: `useEffect` on mount detects `?d=` or `?c=` params and sets `isAuthorized(true)` before billingAccounts load
  - `displayPhone()` utility added to `AdminDashboardView.tsx` — formats `lead.whatsapp` in leads table
  - `formatPhone()` utility added to `DentistPortalView.tsx` — formats WhatsApp on profile load and masks input in real-time
- **QA Fix Session (15 issues resolved):**
  - Installed `qrcode.react` — replaced lucide QrCode icon with real `QRCodeSVG` in CheckoutPixView
  - Added safety guard `useEffect` to redirect from `validation`/`results` if required state is missing (blank screen fix)
  - `generateVolumeSeed` now creates 10 seed `LeadRecord`s distributed across 5 dentists with varied statuses
  - `handleConfirmCheckout` now also creates a `DentistRecord` with `publicSlug` so Bio Link actually resolves
  - `DentistPortalView` now receives correct `planConfig` from dentist's actual plan and correct `billingAccount` from dentist's actual account
  - Added fallback UI ("Em Breve") for ghost views `clinic-portal` and `partner-clinics`
  - `DispatchView`: fixed `"{scores?.recommendation}"` — now guards against `undefined`
  - `ConsentView` and `CaptureView`: added `onBack` prop with "← Voltar" button
  - `CheckoutPixView`: replaced `alert("Código PIX copiado!")` with inline `pixCopied` state feedback
  - `CheckoutDoneView`: replaced `alert("Bio Link copiado!")` with inline `linkCopied` state feedback; fixed button text "Ir para Tela de Login" → "Voltar ao Início"; improved slug normalization to handle accents
  - Added WhatsApp format validation in `handleLeadSubmit` and `handleCheckoutSubmit` (min 10 digits after stripping non-digits)
  - Seed dentists now have varied plan tiers (`lite`, `pro`, `network`) to test DentistPortalView plan-specific features
- **UX Improvement Session:**
  - `CaptureView`: Full redesign — dark camera frame, SVG mouth/teeth positioning guide (viewfinder corner markers, oval ellipse, 8 tooth shapes), 3-step instruction cards
  - `ResultsView`: Added Urgency Score Card (0–100, color-coded red/amber/green, pulsing dot for urgent, progress bar, "Janela de Intervenção Ideal" with timeframes)
  - `LandingView`: Redesigned with social proof (+4.200 triagens, 97% aprovação, ~30s), trust badges, and "Como Funciona?" 4-step section with second CTA
  - `AnalyzingView`: Converted to function component with `useState`/`useEffect`; cycling stage messages ("Detectando simetria...", "Calculando croma...", etc.) + progress bar; `ANALYZING_STAGES` constant defined at module level
  - `ValidationView`: Red overlay on photo when validation fails (XCircle icon + feedback card), green check badge on success, loading overlay
  - `DispatchView` (full report): Complete redesign into 6-section premium document — dark header (patient name + date), Sumário Executivo (score circle + specialty + ticket), Análise Técnica com barras por métrica, Janela de Intervenção, Recomendação da IA, Observações Clínicas, Plano de Ação (3 passos numerados), CTA de agendamento
  - `PricingView`: Differentiated feature lists per plan (Lite/Pro/Network) with color-coded highlights, "Mais Popular" badge on Pro plan, blue accent for Pro CTA button
