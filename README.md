# Lauralink

Lauralink é uma aplicação full-stack implantada em Cloudflare Workers para enviar e compartilhar lotes de arquivos com QR code e proteção opcional por senha.

O app permite subir até 10 arquivos em um único share, gerar um link público e exibir um QR code para acesso rápido. Quando configurado, o download pode ser protegido por senha, mas a vitrine do share continua acessível.

## Recursos principais

- Upload de até 10 arquivos por lote
- Geração de link público único para o lote
- QR code embutido para facilitar o compartilhamento
- Proteção opcional por senha para downloads
- Downloads desbloqueados em sessão de navegador via cookie
- Armazenamento de arquivos em Cloudflare R2
- Metadados de share e arquivos persistidos em Cloudflare D1
- Backend em Hono e frontend em React Router com Vite

## Tecnologias usadas

- **Frontend**: React 19, React Router 7
- **Backend**: Hono rodando em Cloudflare Workers
- **Armazenamento**: R2 para arquivos, D1 para metadados
- **Build**: Vite + `@cloudflare/vite-plugin`
- **Estilo**: Tailwind CSS
- **Deploy**: Wrangler

## Como funciona

1. O usuário faz upload de até 10 arquivos e escolhe uma senha opcional.
2. Os arquivos são enviados para um bucket R2 e os metadados são gravados no banco D1.
3. O app gera um link do tipo `/f/:id` e um QR code para o share.
4. Se o share tiver senha, o usuário precisa desbloquear os downloads no navegador.
5. Downloads protegidos usam sessão de cookie com `SHARE_SESSION_SECRET`.

## Requisitos de ambiente

A aplicação requer as seguintes bindings configuradas em `wrangler.jsonc`:

- `FILES_BUCKET` — bucket R2 para armazenar arquivos
- `FILES_DB` — banco D1 para armazenar os metadados
- `SHARE_SESSION_SECRET` — segredo para assinar cookies de sessão de desbloqueio

A variável de ambiente de exemplo está em `.dev.vars.example`.

## Scripts úteis

- `bun run dev` — inicia o app em modo desenvolvimento
- `bun run build` — constrói a aplicação para produção
- `bun run preview` — roda o preview local do build
- `bun run deploy` — compila e faz deploy via Wrangler
- `bun run cf-typegen` — gera tipos Cloudflare Workers
- `bun run typecheck` — executa `cf-typegen`, `react-router typegen` e `tsc -b`

## Configuração local

1. Copie `.dev.vars.example` para `.dev.vars` ou outra forma de carregar variáveis de ambiente.
2. Defina `SHARE_SESSION_SECRET` com um segredo forte.
3. Garanta que as bindings R2 e D1 estejam configuradas no seu ambiente Cloudflare.
4. Execute `bun i` e depois `bun run dev`.

## Estrutura do projeto

- `workers/` — backend Hono e rotas de API
- `app/` — frontend React Router e lógica da interface
- `migrations/` — migrações D1 para tabelas de shares e arquivos
- `public/` — ativos estáticos
- `wrangler.jsonc` — configuração do Workers e bindings

## Notas importantes

- A senha protege apenas o download dos arquivos, não a visualização do share.
- Downloads de shares com senha exigem que `SHARE_SESSION_SECRET` esteja definido.
- O limite de upload por lote é de 10 arquivos e existe um teto de tamanho total.
