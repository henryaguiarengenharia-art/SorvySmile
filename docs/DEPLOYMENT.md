# Implantação e rollback

## 1. Preparar a homologação gratuita

O projeto autorizado para esta etapa é exclusivamente
`sorvysmile-homologacao`. A partir da raiz do repositório, no Google Cloud
Shell da conta proprietária, execute:

```bash
npm run setup:hml
```

O script é idempotente e recusa `sorvysmile`. Ele executa testes e auditorias,
habilita Authentication por Email/Password e Anonymous, cria o Firestore
Standard em `southamerica-east1`, registra o app Web, publica regras/índices,
cria um perfil fictício e publica o canal `migracao-smile` por 30 dias. Nesta
fase não há Functions, Storage, Gemini, App Check, InfinitePay ou dados reais.

## 2. Preparar o backend completo após aprovação do Blaze

1. ative o plano Blaze apenas em `sorvysmile-homologacao`;
2. configure a política de senha com no mínimo 10 caracteres;
3. ative a limpeza automática de contas anônimas;
4. configure App Check com reCAPTCHA Enterprise;
5. habilite o Vertex AI e conceda `roles/aiplatform.user` somente à identidade
   de runtime das Functions;
6. execute novamente todos os testes antes de publicar Functions;
7. mantenha `sorvysmile` sem alterações até o aceite final.

Depois de configurar o secret e os valores públicos do ambiente, execute:

```bash
npm run deploy:hml
```

Esse comando recusa explicitamente `sorvysmile`, exige faturamento ativo,
valida os links InfinitePay, habilita o Vertex AI em `southamerica-east1`,
executa testes e auditorias, publica as Functions e recompila o mesmo canal
temporário. O App Check fica desativado apenas nessa homologação enquanto a
jornada funcional é validada; produção mantém o padrão seguro
`ENFORCE_APP_CHECK=true`.

## 3. Configurar frontend

Copie `.env.example` para `.env.local` e preencha:

- configuração pública do Firebase;
- chave pública do App Check;
- links atuais da InfinitePay para Lite, Pro e Network;
- confirme que o checkout de R$ 497 está identificado como Network antes do corte;
- WhatsApp comercial;
- email público de privacidade;
- slug padrão opcional. Deixe vazio para manter a raiz como página comercial;
  o cliente piloto continuará em `/p/clinica-saude-integrada-bh`.

Esses valores são públicos. Não coloque chave do Gemini, senha ou credencial
administrativa em arquivo `VITE_*`.

## 4. Configurar backend

O backend usa o Vertex AI com Application Default Credentials da própria
Function. Não crie nem distribua uma chave Gemini. O modelo padrão é
configurável por `GEMINI_MODEL`, e a localização por
`GEMINI_VERTEX_LOCATION`.

## 5. Validar

```bash
npm ci
npm --prefix functions ci
npm run build:all
npm run test:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev
git diff --check
```

O emulador do Firestore requer Java 21 ou superior. Faça os testes de regras
antes de qualquer deploy.

## 6. Publicar preview completo

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
npm run build
firebase hosting:channel:deploy migracao-smile --expires 14d
```

Não use o domínio final nessa etapa.

## 7. Preparar HQ e piloto

Crie o usuário HQ pelo comando administrativo, digitando os valores apenas no
Shell:

```bash
HML_HQ_EMAIL="email-hq" \
HML_HQ_PASSWORD="senha-forte" \
HML_CLINIC_EMAIL="email-clinica" \
HML_CLINIC_PASSWORD="senha-temporaria-forte" \
HML_CLINIC_WHATSAPP="55DDDNUMERO" \
npm run seed:hml
```

O wrapper cria HQ e clínica Network somente em `sorvysmile-homologacao`.
O segundo acesso profissional deve ser criado pelo painel da clínica durante
o teste funcional, validando a mesma Function usada pelo produto. Digite as
credenciais temporárias diretamente no Shell e não as salve no repositório.

## 8. Roteiro de homologação

- link limpo e parâmetros legados;
- consentimento e recusa;
- foto inadequada e limite de tentativas;
- preview antes do contato;
- captura com duas autorizações;
- cota por plano;
- WhatsApp e atualização do funil;
- fila da clínica, atribuição e isolamento por dentista;
- criação, pausa e reativação de acesso da equipe;
- exclusão de lead;
- cadastro de assinante;
- link de pagamento e mensagem do comprovante;
- ativação, pausa e reativação pela HQ;
- isolamento entre duas contas de teste;
- navegação móvel;
- Política de Privacidade e Termos.

## 9. Corte sem interrupção

1. mantenha o Replit ativo;
2. valide o preview com o cliente atual;
3. faça backup e marque a versão que está em uso;
4. publique Firebase Hosting;
5. troque apenas o domínio/link divulgado;
6. monitore erros, uso e conversão por pelo menos sete dias;
7. revogue a chave Gemini e credenciais expostas no protótipo;
8. cancele o Replit apenas depois da estabilização.

Todas as credenciais que ficaram codificadas no protótipo devem ser consideradas
expostas, revogadas e nunca reutilizadas no Firebase.

## Rollback

- restaure o domínio/link para o Replit;
- reverta o Hosting para a versão anterior;
- não apague Firestore, usuários ou secrets;
- corrija em novo canal de preview;
- mantenha o histórico da migração em branch e PR separados.
