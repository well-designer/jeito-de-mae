# Jeito de Mãe — Delícias Caseiras

Sistema de pedidos online (estilo iFood) para o restaurante da família:
cardápio com fotos, carrinho, checkout com dados de entrega, **Pix com
confirmação automática**, aviso de pedido novo no WhatsApp e painel
administrativo com login.

Stack: **Next.js 14** (App Router) · **Supabase** (Postgres + login + fotos) ·
**Mercado Pago** (Pix) · **WhatsApp Cloud API** (avisos).

---

## Vercel ou Railway?

**Use a Vercel.** Motivos, na ordem que importa para vocês agora:

| | Vercel | Railway |
|---|---|---|
| Plano grátis | Sim, sem cartão, sem prazo | US$ 5 de crédito/mês; acabou, o app cai |
| Next.js | É de quem fez o Next | Funciona, mas você configura na mão |
| Webhook do Mercado Pago | Funciona direto | Funciona |
| Custo quando crescer | Só se passar do Hobby | Cobra por hora ligada |

O Railway só compensa depois, se vocês quiserem algo que precise de um
processo rodando o tempo todo (impressão automática de comanda na cozinha,
por exemplo). Hoje não é o caso — e "não gastar agora" é o seu critério.

O banco **não** vai na Vercel: fica no Supabase, que também tem plano grátis
permanente (500 MB de banco e 1 GB de fotos, muito além do que um
restaurante de bairro consome).

Custo total hoje: **R$ 0/mês**, fora as taxas do Mercado Pago por venda.

---

## Passo a passo do deploy

### 1. Supabase

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e rode.
3. Em **Authentication → Users → Add user**, crie o login de vocês
   (e-mail + senha). Marque "Auto Confirm User".
4. Copie o UUID do usuário criado e rode no SQL Editor:
   ```sql
   insert into public.perfis (id, nome, papel)
   values ('COLE-O-UUID-AQUI', 'Mãe', 'admin');
   ```
   Repita para cada pessoa que vai ter acesso ao painel.
   **Quem não estiver nessa tabela não entra, mesmo tendo conta.**
5. Em **Settings → API**, copie: `Project URL`, `anon public` e
   `service_role` (essa última é secreta).

### 2. GitHub

```bash
cd jeito-de-mae
git init
git add .
git commit -m "Sistema de pedidos Jeito de Mae"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/jeito-de-mae.git
git push -u origin main
```

O `.gitignore` já impede que o `.env` vá junto. **Nunca** comite chaves.

### 3. Vercel

1. https://vercel.com → **Add New → Project** → importe o repositório.
2. Em **Environment Variables**, cadastre tudo que está em `.env.example`.
3. Deploy. Anote a URL final e volte para preencher `NEXT_PUBLIC_SITE_URL`
   com ela, depois faça um redeploy.

### 4. Mercado Pago

1. https://www.mercadopago.com.br/developers/panel → crie uma aplicação.
2. Copie o **Access Token de produção** para `MP_ACCESS_TOKEN`.
3. Em **Webhooks → Configurar notificações**, cadastre:
   `https://SEU-SITE.vercel.app/api/webhooks/mercadopago`
   evento **Pagamentos**. Copie a **chave secreta** para `MP_WEBHOOK_SECRET`.
4. Teste com um Pix de R$ 0,01 antes de divulgar.

> A conta precisa ser do CPF/CNPJ de quem recebe. O dinheiro cai na conta
> Mercado Pago e vocês transferem para o banco quando quiserem.

### 5. WhatsApp — sem tomar ban

**Não use** whatsapp-web.js, Baileys, Venom, Z-API não oficial ou bot rodando
num celular antigo. Todos se passam pelo WhatsApp Web, violam os termos e o
banimento do número é rotina — e levaria junto o WhatsApp comercial da família.

O caminho certo é a **WhatsApp Cloud API**, oficial da Meta e gratuita para o
volume de vocês:

1. https://developers.facebook.com → criar app do tipo **Business**.
2. Adicione o produto **WhatsApp**, pegue o `Phone Number ID` e gere um token
   permanente (System User com permissão `whatsapp_business_messaging`).
3. Em **Message Templates**, crie um template chamado `novo_pedido`,
   categoria **Utility**, idioma **Português (BR)**, com este corpo:

   ```
   Novo pedido {{1}} de {{2}}. Itens: {{3}}. Total: {{4}}.
   ```

   A aprovação costuma sair em minutos.
4. Preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_DESTINO`
   (número que recebe o aviso, formato `5511999999999`).

O aviso dispara sozinho quando o Pix é confirmado, ou na hora do pedido
quando o pagamento é em dinheiro.

---

## Rodando na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

Painel em `/admin` (redireciona para `/login` se não estiver logado).

Para testar o webhook local, use `ngrok http 3000` e aponte a URL do
Mercado Pago para o endereço temporário do ngrok.

---

## Como a segurança foi montada

Vocês vão guardar nome, telefone e endereço de clientes. A LGPD trata isso
como dado pessoal, então o projeto já nasce assim:

- **RLS ligado e sem policies em todas as tabelas.** Nenhum navegador lê o
  banco direto. Mesmo que alguém descubra a URL do Supabase e a chave `anon`
  (que é pública por natureza), as consultas voltam vazias. Todo acesso passa
  pelo servidor do Next.js.
- **A `service_role` key só existe no servidor.** Ela nunca é importada em
  arquivo com `'use client'`. Se vazasse, daria acesso total ao banco.
- **Preços recalculados no servidor.** O navegador manda só qual produto e
  qual tamanho. Quem editar o JSON para mandar "feijoada por R$ 1" recebe o
  preço real de volta.
- **Webhook com assinatura HMAC conferida.** Sem isso, qualquer pessoa
  chamaria a URL e marcaria pedidos como pagos sem ter pagado.
- **O webhook não acredita no que recebe:** ele consulta a API do Mercado
  Pago para saber o status verdadeiro do pagamento.
- **Duas barreiras no painel:** middleware bloqueia a rota e cada endpoint
  confere de novo sessão + presença na tabela `perfis`.
- **Toda entrada validada com Zod** (tamanho, formato, limites) antes de
  tocar no banco.
- **Rate limit** por IP na criação de pedidos, contra flood de trote.
- **Cabeçalhos de segurança** (CSP, HSTS, X-Frame-Options) em `next.config.mjs`.
- **Vocês nunca veem cartão.** O Mercado Pago cuida do pagamento; o sistema
  só guarda o id da transação.
- Mensagem de erro do login é genérica de propósito: não revela se o e-mail
  existe.

### O que ainda vale fazer depois
- Ativar 2FA nas contas Supabase, Vercel, GitHub e Mercado Pago.
- Publicar uma política de privacidade curta no rodapé (exigência da LGPD).
- Apagar pedidos com mais de 6 meses — dado que não existe não vaza.
- Trocar o rate limit em memória por Upstash Redis se o movimento crescer.

---

## Controle financeiro

A aba **Financeiro** do painel mostra, para hoje / esta semana / semana passada /
este mês / tudo:

- número de vendas, faturamento, ticket médio e quantas foram entrega
- quebra dia a dia ("Segunda — 20 vendas — R$ 500,00")
- total por forma de pagamento (Pix e dinheiro separados)
- Pix ainda não confirmado, contado à parte para não inflar o faturamento

O botão **Baixar planilha** gera um CSV que abre direto no Excel e no Google
Planilhas, com separador `;` e acentuação correta.

O que conta como venda: pedido não cancelado que já foi pago no Pix, ou pedido
em dinheiro. Pix pendente e pedido cancelado ficam de fora do faturamento e
aparecem separados — assim o número que vocês olham é dinheiro que entrou de
verdade.

Nada disso exigiu mudança no banco: os dados já estavam na tabela `pedidos`.

---

## Estrutura

```
src/
  app/
    page.js                      cardápio público (renderizado no servidor)
    login/page.js                login do painel
    admin/page.js                painel (protegido)
    api/
      pedidos/route.js           cria pedido + cobrança Pix
      pedidos/status/route.js    a tela do Pix consulta aqui
      webhooks/mercadopago/      confirmação automática do pagamento
      admin/relatorio/route.js   relatório financeiro + exportação CSV
      admin/...                  cardápio, config, pedidos, upload de fotos
  components/
    Loja.jsx                     interface do cliente
    Admin.jsx                    interface do painel
  lib/
    supabaseAdmin.js             acesso ao banco (só servidor)
    supabaseServer.js            sessão + porteiro do painel
    mercadopago.js               Pix e validação de assinatura
    whatsapp.js                  aviso de pedido novo
    validation.js                schemas Zod
    rateLimit.js                 limite por IP
supabase/schema.sql              tabelas, RLS, storage e cardápio inicial
middleware.js                    bloqueia /admin sem sessão
```
