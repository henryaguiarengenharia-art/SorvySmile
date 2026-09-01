# Checklist técnico de produção

Este checklist é bloqueante. Ele valida o projeto `sorvysmile` sem executar
deploy e sem alterar dados.

## 1. Configuração obrigatória

- `.env.production` aponta exclusivamente para o Firebase `sorvysmile`;
- `functions/.env.sorvysmile` contém:
  - `ENFORCE_APP_CHECK=true`;
  - `GEMINI_MODEL` definido;
  - `INFINITEPAY_HANDLE=henry-augusto-pinheiro`;
  - `PUBLIC_APP_URL=https://sorvysmile.web.app`;
- `GEMINI_API_KEY` está no Secret Manager e não em arquivo `VITE_*`;
- Email/Password e Anonymous estão habilitados no Firebase Authentication;
- limpeza automática de usuários anônimos está habilitada;
- App Check com reCAPTCHA Enterprise está registrado para o domínio oficial;
- Blaze, APIs necessárias e política de limpeza de artefatos estão ativos.

## 2. Pagamento automático

- o botão de assinatura cria o pedido no backend com preço obtido do plano;
- o backend envia `order_nsu`, `redirect_url` e `webhook_url` à InfinitePay;
- o webhook é público, mas não confia no payload recebido;
- o backend reconfirma `order_nsu`, `transaction_nsu`, `slug` e valor em
  `payment_check`;
- a mesma transação não pode ativar dois pedidos;
- reenvios do webhook são idempotentes;
- aprovação atualiza conta, profissional, perfil público, vencimento, claims,
  histórico, auditoria e funil;
- no vencimento, regras e backend bloqueiam a operação imediatamente e a rotina
  horária marca a conta como atrasada sem apagar dados;
- novo pagamento de uma conta atrasada cria outro pedido e reativa 30 dias;
- retorno do navegador repete a confirmação segura e abre o painel ativo;
- a HQ mantém a ativação manual apenas como contingência auditada.

## 3. Validação antes do corte

Execute no Cloud Shell autenticado:

```bash
FIREBASE_PROJECT_ID=sorvysmile npm run check:prod
```

Além do resultado automatizado, confirme manualmente:

- Checkout Integrado habilitado na conta InfinitePay;
- pagamento real em homologação: Lite e Pro;
- webhook recebido uma única vez ou reprocessado sem duplicidade;
- pagamento com valor divergente não libera acesso;
- retorno sem sessão orienta novo login sem perder o pagamento;
- trial preparado e trial expirado convertem para assinatura;
- próximo vencimento aparece 30 dias após a aprovação;
- vencimento simulado bloqueia CRM, IA e vitrine e mantém o checkout acessível;
- limites Lite e Pro mudam imediatamente após atualizar o token;
- perfil público fica ativo sem perder fotos, links ou assistente;
- rollback do Hosting e da versão anterior das Functions está documentado;
- backup do Firestore e monitoramento de erros estão ativos.

## 4. Ordem de publicação

1. criar e revisar os arquivos de ambiente de produção;
2. executar `npm run check:prod`;
3. publicar regras, índices e Storage;
4. publicar Functions, incluindo as três Functions da InfinitePay;
5. conceder invocação pública ao webhook e às duas callables;
6. publicar Hosting;
7. executar um pagamento real controlado;
8. monitorar logs, pedidos pendentes, transações e ativações por 24 horas;
9. liberar o piloto antes da divulgação ampla.

Não marque produção como aprovada se qualquer item bloqueante falhar.
