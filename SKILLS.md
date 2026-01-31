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
