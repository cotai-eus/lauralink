# 🛠️ Project Skills & Capabilities

Contexto técnico obrigatório para o desenvolvimento do SaaS File-Share.

## 📦 Capability: R2 Direct Uploads (Presigned URLs)
**Padrão Obrigatório:** Não fazer proxy de binários pelo Worker.
**Implementation Pattern:**

```typescript
// Core Logic (Use Case)
import { AwsClient } from 'aws4fetch'; // Ou S3Client do SDK v3 (leve)

export async function generateUploadUrl(r2Bucket: R2Bucket, fileId: string) {
  // Use S3 compat layer para presign, pois native R2 API não suporta presign ainda de forma nativa simples
  // OU use lógica customizada de assinatura AWS V4 se não quiser deps.
  // PREFERÊNCIA: Usar @aws-sdk/client-s3 com request handler leve.
  
  const command = new PutObjectCommand({
    Bucket: "my-bucket",
    Key: fileId,
    ContentType: "application/pdf", // Deve bater com o client
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn: 300 });
}

```

**Regra CORS no R2 (wrangler.toml / Dashboard):**

```json
[
  {
    "AllowedOrigins": ["[https://app.seusite.com](https://app.seusite.com)", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "Content-MD5", "x-amz-*"],
    "ExposeHeaders": ["ETag"]
  }
]

```

---

Notas de produção e recomendações adicionais:

- URLs curtas: gerar `presigned URLs` com tempo de expiração curto (ex.: 5 minutos) por padrão.
- Validação pós-upload: sempre executar um `HEAD` no objeto R2 após a conclusão e, quando possível, verificar checksum (Content-MD5) para garantir integridade.
- Arquivos grandes: para uploads muito grandes, preferir uploads chunked/resumable cliente-side (ou instruir o client a usar múltiplos PUTs e reassembly), e documentar limites de Content-Length no cliente.
- CORS mínimo: permitir apenas origens necessárias e cabeçalhos essenciais (limitar `AllowedHeaders`).

## 🗄️ Capability: D1 Database Management

**Padrão Obrigatório:** Integridade e Tipagem.
**Anti-Pattern:** Usar `KV` para dados relacionais.

**Query Pattern (Hono Context):**

```typescript
// ✅ DO:
const result = await c.env.DB.prepare(
  `SELECT * FROM files WHERE user_id = ? AND status = ?`
)
.bind(userId, 'active')
.all<FileEntity>();

// ❌ DON'T:
// await c.env.DB.prepare(`SELECT * FROM files WHERE user_id = '${userId}'`).run();

```

---

## ⚡ Capability: Durable Objects (Rate Limiting)

**Uso:** Controle de concorrência e alarmes de expiração.

**Class Pattern:**

```typescript
export class RateLimiter implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    let count = (await this.state.storage.get<number>(ip)) || 0;
    
    if (count > 100) return new Response("Rate Limit Exceeded", { status: 429 });
    
    await this.state.storage.put(ip, count + 1);
    // Setup alarm to clear count in 1 minute
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + 60 * 1000);
    }
    
    return new Response("OK");
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}

```

---

## 🧩 Capability: Clean Architecture in Workers

**Folder Structure Rules:**

1. **Handlers (`src/adapters/http`)**: Apenas extraem dados do `c.req` e chamam o UseCase. Retornam JSON.
2. **UseCases (`src/core/usecases`)**: Contêm a lógica (`if user.plan == free`). Não sabem o que é Hono.
3. **Gateways (`src/infra`)**: Implementam as interfaces (ex: `saveMetadata(file)`). É aqui que chamamos `c.env.DB` ou `c.env.R2`.

Observações arquiteturais:

- Injeção de dependência: crie factories para injetar bindings (DB, R2, DO) nos UseCases durante inicialização para facilitar testes.
- Side-effects isolados: persistência e chamadas a redes devem ficar apenas nos gateways.

---

## 🧪 Capability: Testing Strategy

**Ferramentas:** Vitest + Miniflare (Workerd).
**Regra:** Testes de integração devem simular o binding do D1 e R2 em memória.

```typescript
// Exemplo de teste de integração
it('should create upload intent', async () => {
  const { env } = await getMiniflareBindings();
  const res = await app.request('/api/upload', { 
    method: 'POST', 
    body: JSON.stringify({ filename: 'test.png' }) 
  }, env);
  expect(res.status).toBe(200);
});

```

Melhorias e práticas de teste (adicionar ao README de testes):

- Factory de bindings: forneça uma função `getMiniflareBindings()` reutilizável que cria bindings simulados para D1, R2 e DOs e garanta teardown/limpeza entre testes.

Exemplo de `getMiniflareBindings()` (esboço):

```typescript
// test/utils/miniflare.ts
import { Miniflare } from 'miniflare';

export async function getMiniflareBindings() {
  const mf = new Miniflare({
    // configurar bindings de D1, R2, Durable Objects e env vars mínimos
  });
  const env = await mf.getBindings();
  return { mf, env };
}
```

- Comandos recomendados para CI local/CI:

```bash
# instalar deps
npm ci
# rodar miniflare headless + vitest (exemplo)
npx miniflare -c miniflare.config.mjs --quiet &
npx vitest run
```

- Testes determinísticos: use seeds e fixtures, e garanta teardown (limpeza de storage) entre cenários.

---

## Observability & Tracing

- Obrigatório: expor métricas Prometheus (exportáveis pelo Worker/Worker-side telemetry):
  - `lauralink_uploads_total` (counter)
  - `lauralink_upload_failures_total` (counter)
  - `lauralink_downloads_total` (counter)
  - `lauralink_request_latency_seconds` (histogram)
  - `lauralink_active_files_gauge` (gauge)

- Labels recomendadas: `service`, `handler` (ex.: `upload-intent`, `finalize-upload`), `region`, `status`.

- Logs: usar JSON estruturado contendo `timestamp`, `level`, `message`, `trace_id`, `user_id`, `file_id`, `duration_ms`, `error_code`.

- Tracing: propague `trace_id` em headers e registros para correlacionar flows (upload-intent → finalize → DO alarms → cleanup).

## Segurança Operacional

- Secrets: nunca commitar secrets. Use Vault ou o Secrets Manager do provedor (Cloudflare Secrets / environment bindings) para armazenar credenciais.
- Pre-commit & CI: obrigar secret-scan (trufflehog, detect-secrets) e linters; bloquear merges quando SAST/secret-scan falharem.
- SAST: adicionar etapa SAST no pipeline (ex.: semgrep, eslint-plugin-security) como check obrigatório antes do merge.
- Rotação de chaves: preferir short-lived credentials e documentar procedimento de rotação e revogação.
- Comunicação segura: adotar mTLS entre serviços críticos quando aplicável e assinar ações irreversíveis com envelope de audit (sig + public_key_id).

## Resiliência & Retry

- Padrão de retry exponencial (recomendado): base 1s, multiplier 2, max attempts 5, jitter ±20%.
- Endpoints mutacionais (ex.: `/upload-intent`, `/finalize`) devem aceitar e armazenar `Idempotency-Key` para evitar duplicação de efeitos.
- DLQ: mensagens/eventos que falharem validação/processing repetidamente devem ir para DLQ com `reason` e `attempt_count`. Documentar processo de reprocessamento.
- Validação pós-upload: executar `HEAD` no objeto R2 e verificar checksum (Content-MD5) antes de marcar `active`.

## CI/CD & Testes (exemplo prático)

- Jobs recomendados (ordem): `install` → `typecheck` → `lint` → `test:unit` → `test:integration` (Miniflare) → `sast` → `secret-scan` → `deploy`.
- Exemplo (comandos) para uso em runner/CI:

```bash
npm ci
npm run lint
npm run build
npx miniflare -c miniflare.config.mjs --quiet &
npx vitest run --run
npm run sast # exemplo: semgrep
npx trufflehog filesystem --exclude-paths node_modules
```

- GitHub Actions tip: executar testes de integração em runner com Miniflare headless e bindings mínimos.

## Métricas específicas para Durable Objects e R2

- Durable Objects (sugestões): `do_requests_total{do_name="rate_limiter"|"file_expiration"}`, `do_alarm_runs_total`, `do_storage_bytes`.
- R2: instrumentar operações de PUT/HEAD/GET quando possível via worker: `r2_put_requests_total`, `r2_head_errors_total`.

## Performance & Uploads grandes

- Para uploads instáveis ou muito grandes, considerar:
  - Chunked/resumable uploads (cliente corta em partes e reenvia); reconstrução pode ser feita server-side ou por job assíncrono.
  - Fornecer instruções de retry do lado do cliente e limites de chunk size.
  - Usar checksums para cada chunk quando aplicável.

## Auditabilidade (checklist)

- Registrar `trace_id` em todas as operações críticas.
- Persistir rationale + signature para mudanças que afetam produção (deletes manuais, rollbacks).
- Armazenar metadados de auditoria em banco append-only (ou object store imutável) por no mínimo o SLA exigido.
