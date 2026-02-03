# AGENTS.md

-------------------------------------------------------------------------------
Introdução

Missão do ecossistema
Este ecossistema Multi-Agente (MAS) foi projetado para automatizar pipelines complexos de engenharia de software e operações (ex.: automação de Supply Chain ou DevSecOps), orquestrando tarefas especializadas por agentes autocontidos que colaboram usando protocolos padronizados. Objetivos principais:
- Modularidade: dividir responsabilidade por agentes especializados.
- Observabilidade: logs e telemetria por agente com correlação por trace_id.
- Resiliência: estratégias de retry, versionamento de mensagens e checkpoints de estado.
- Auditabilidade: armazenamento imutável de decisões críticas e razões.
- Eficiência: delegação e paralelização de tarefas com controle de custo computacional.

Stack Tecnológica Recomendada
- Infraestrutura: Kubernetes (K8s) com namespaces por ambiente (dev/stage/prod), autoscaling horizontal.
- Mensageria: Kafka para eventos assíncronos e Redis Streams para filas de baixa latência. Use gRPC para chamadas síncronas críticas.
- Serialização: JSON-encoded payloads com validação Pydantic em cada agente; protobuf opcional para canais de alto desempenho.
- Orquestração de estado: Durable Functions / Temporal (opcional) para workflows long-running.
- Modelos de IA: modelos LLM (OpenAI-compatible oR LLMs on-prem) com controle de temperatura, top_p e restrições de tokens.
- Observabilidade: Prometheus + Grafana, ELK stack (ElasticSearch, Logstash, Kibana).
- Segurança: mTLS entre serviços, OAuth2.0 / OIDC para serviço->serviço, secrets gerenciados por Vault.

-------------------------------------------------------------------------------
Visão Geral da Arquitetura de Agentes

Topologia lógica
- Frontdoor/API Gateway: autentica solicitações externas e cria um pedido (job) com trace_id.
- Orquestrador: coordena o workflow, cria subjobs e delega a agentes especialistas.
- Agentes especialistas (Researcher, Data Analyst, Coder, QA): processam tarefas específicas e reportam status.
- Data Lake/State Store: armazena artefatos, checkpoints e memórias de longo prazo.
- Monitoring & Control Plane: painel operacional para intervenções manuais e replay.

Comunicação:
- Assíncrona: eventos Kafka (topic por tipo de evento: job.created, task.assigned, task.completed, task.failed).
- Síncrona: gRPC endpoints quando latência e consistência forte são necessárias (ex.: validation synchronous check).
- Callbacks e webhooks: usados para integração com sistemas externos (CI/CD, SCM).

-------------------------------------------------------------------------------
Protocolos de Comunicação

Princípios:
- Mensagens idempotentes sempre que possível.
- Cada mensagem inclui: id (UUIDv4), trace_id (UUIDv4), timestamp ISO8601, version (semver da schema), source_agent, dest_agent(s), intent, payload.
- Versão de schema no cabeçalho impede que agentes antigos processem payloads não compatíveis.
- Validar no início do handler com Pydantic; rejeitar com código de erro padronizado.

Exemplo genérico de cabeçalho (JSON)
```json
{
  "id": "uuidv4",
  "trace_id": "uuidv4",
  "timestamp": "2026-02-03T12:34:56.789Z",
  "version": "1.2.0",
  "source": "orchestrator",
  "destination": ["researcher"],
  "intent": "gather_background",
  "ttl_seconds": 3600
}
```

Schemas Pydantic (exemplos JSON) — mensagens de domínio
- O formato abaixo deve ser representado como modelos Pydantic nos agentes consumidores.

1) JobCreated schema
```json
{
  "schema": "JobCreated.v1",
  "job_id": "string (uuid4)",
  "owner": "string (user_id)",
  "description": "string",
  "priority": "enum: low|medium|high|critical",
  "input_refs": [
    { "type": "git", "url": "string", "ref": "string" }
  ],
  "metadata": { "ci": "true", "sla_seconds": 86400 }
}
```

2) TaskAssignment schema
```json
{
  "schema": "TaskAssignment.v1",
  "task_id": "string (uuid4)",
  "job_id": "string (uuid4)",
  "assigned_to": "string (agent_id)",
  "task_type": "enum: research|analyse|code|qa",
  "deadline_iso": "string (ISO8601)",
  "context": {
    "repo": "https://github.com/owner/repo",
    "issue_number": 123
  }
}
```

3) AgentResult schema (para eventos task.completed)
```json
{
  "schema": "AgentResult.v1",
  "task_id": "string",
  "job_id": "string",
  "agent_id": "string",
  "status": "enum: success|partial|failed",
  "outputs": {
    "artifacts": [
      { "type": "url", "location": "s3://bucket/path", "hash": "sha256:..." }
    ],
    "metrics": { "coverage": 0.92 }
  },
  "explanation": "string (human readable)",
  "duration_ms": 12345
}
```

Metadados de segurança (envelope)
```json
{
  "sig": "base64(signature)",
  "public_key_id": "key-id",
  "encryption": { "alg": "A256GCM", "key_id": "enc-key-id" }
}
```

Mensageria e topologias
- Kafka topics:
  - orchestration.jobs.v1
  - orchestration.tasks.v1
  - agents.results.v1
  - events.audit.v1
- Keying: usar job_id como chave para garantir ordenação por job.
- Partitions: dimensionar por throughput e cardinalidade de job_id.

-------------------------------------------------------------------------------
Diretório de Agentes

Formato de cada entrada:
- Objetivo (System Prompt base) — texto que serve como base para o comportamento do agente.
- Capabilities — lista de ferramentas, APIs e permissões.
- Memory Management — short-term e long-term: estrutura, limites, estratégia de resumo e persistência.
- Hiperparâmetros recomendados de inferência (Temperature, Top-p, Max tokens, Frequency/Presence penalties).
- Observability: métricas e logs a capturar.

1) Orquestrador (Orchestrator)

Objetivo (System Prompt base)
- "Você é o Orquestrador do sistema: responsável por decompor jobs, alocar tarefas a agentes especialistas, monitorar progresso, reagir a falhas e garantir SLAs. Priorize consistência e auditabilidade. Emita comandos claros, verifique versões de schema e registre decisões."

Capabilities
- Interfaces:
  - Kafka producer/consumer (full ACL)
  - gRPC client para serviços síncronos
  - Temporal/Workflow client (opcional)
  - Storage: gravação de job manifests no Object Store + DB (Postgres)
- Operações:
  - Gerar task_ids (UUIDv4)
  - Retentativa com exponential backoff
  - Checkpointing: persistir estado do workflow
  - Escalonamento: elevar tarefas para intervenção humana

Memory Management
- Short-term:
  - Job runtime state em memória (ephemeral cache, TTL curto — ex.: 30 min)
  - Checkpoints periódicos a cada estado transicional
- Long-term:
  - Job manifests, decisões e logs armazenados em DB imutável (append-only)
  - Rationale/decisions salvas para auditoria (speech-to-text quando aplicável)
- Política de retenção:
  - Metadados por 1 ano, artefatos por SLA do cliente.

Hiperparâmetros (Inferência de LLM para geração de decomposição de tarefas)
- Temperature: 0.0 – 0.2 (determinístico)
- Top-p: 0.9
- Max tokens: 800
- Frequency penalty: 0.0
- Presence penalty: 0.0

Observability
- Métricas: tasks_issued_total, tasks_failed_total, average_task_latency_seconds
- Logs: decisions, retries, error stack trace, trace_id

2) Pesquisador (Researcher)

Objetivo (System Prompt base)
- "Você é um Pesquisador especializado em levantamentos, análise de contexto externo, coleta de requisitos e buscas bibliográficas/SCM. Produza relatórios sumarizados com referências rastreáveis e proponha hipóteses verificáveis."

Capabilities
- Ferramentas:
  - Web search API (bing/google) com rate limit
  - Git client (clone, grep)
  - DB read-only (knowledge base)
  - Vector DB (semantic retrieval) para memórias de longo prazo
- Operações:
  - Buscar e validar referências
  - Gerar short reports e bibliografias
  - Calcular confiança por fonte

Memory Management
- Short-term:
  - Session cache com artigos e snippets (TTL: 2 horas)
  - Chunked context window para LLM (split por tópico)
- Long-term:
  - Indexação de insights no Vector DB com embeddings (metadata: source, timestamp, confidence)
  - Atualizações incrementais de knowledge base (append)
- Estratégia:
  - Ao armazenar insights, capturar "why" e "how verified".

Hiperparâmetros
- Temperature: 0.2 – 0.5 (criatividade controlada)
- Top-p: 0.8
- Max tokens: 1200
- Retrieval augmentation: top_k=5

Observability
- Métricas: docs_retrieved, avg_retrieval_latency, sources_by_reliability
- Logs: sources list, query strings, embedding ids

3) Analista de Dados (Data Analyst)

Objetivo (System Prompt base)
- "Você é o Analista de Dados: responsável por transformar, validar e interpretar dados experimentais e logs. Produza datasets limpos, análises estatísticas e visualizações resumidas. Priorize reprodutibilidade e testes de hipótese."

Capabilities
- Ferramentas:
  - SQL DB (read/write)
  - PySpark / Pandas runtime
  - Jupyter-like execution sandbox (containerized)
  - ML model evaluation libs (scikit-learn, mlflow)
- Operações:
  - Data validation (Great Expectations)
  - Feature engineering, split datasets
  - Produzir métricas como AUC, precision/recall, drift detection

Memory Management
- Short-term:
  - Scratch storage para dataframes (ephemeral, cleaned)
- Long-term:
  - Dataset versions via Delta Lake / Iceberg
  - Artifacts: model metrics, charts, explanations armazenados em artifact store
- Política:
  - Versão imutável para cada dataset criado; registrar código e seed.

Hiperparâmetros
- Temperature: N/A geralmente não usa LLM para core ops, mas para explicação:
  - If LLM explanations required: temp 0.1–0.3, top_p 0.7
- Resources:
  - CPU bounded and memory quotas per analysis job

Observability
- Métricas: dataset_size_rows, null_rate, schema_drift_rate
- Logs: query plans, sample rows, seeds used

4) Coder (Engineering Agent)

Objetivo (System Prompt base)
- "Você é o agente Coder: responsável por gerar, revisar e aplicar mudanças de código reproduzíveis. Produza commits atômicos, testes unitários e PRs com descrição clara e checklist de segurança."

Capabilities
- Ferramentas:
  - GitHub/GitLab API (scopes: repo:write, checks:read)
  - CI trigger API
  - Code formatter (prettier/black) e static analyzers (lint)
  - Unit test runner (pytest, jest)
  - Secrets checker (trufflehog)
- Operações:
  - Gerar patch/PR, criar branch, atualizar issues
  - Run local static analysis and unit tests before push

Memory Management
- Short-term:
  - Context window of repo files (last N files changed)
  - Staging area with patch diffs
- Long-term:
  - Code rationale entries in knowledge base (design decisions), code templates library
- Estrutura de segurança:
  - Nunca persistir secrets; detectar e abortar commits que contenham secrets

Hiperparâmetros (quando usa LLM para code generation)
- Temperature: 0.0 – 0.2 (determinístico)
- Top-p: 0.9
- Max tokens: 1500 (para patches grandes dividir em hunks)
- Safety: enable code-sanitizer plugin

Observability
- Métricas: prs_created, prs_merged, build_success_rate
- Logs: staged_files, diff_summary, lint_output

5) QA (Quality Assurance Agent)

Objetivo (System Prompt base)
- "Você é o agente de QA: responsável por gerar e executar planos de teste, validar requisitos não-funcionais, e produzir relatórios de cobertura e problemas reproduzíveis."

Capabilities
- Ferramentas:
  - Test orchestration framework (Selenium/Cypress for E2E)
  - Performance runner (k6, JMeter)
  - Coverage tools (coverage.py, istanbul)
  - Fuzzing tools (AFL-like)
- Operações:
  - Gerar casos de teste automatizáveis
  - Executar suites e coletar métricas
  - Reproduzir bugs e anexar artifacts (screenshots, logs)

Memory Management
- Short-term:
  - Current test run metadata and collected artifacts
- Long-term:
  - Known-failures DB, flaky-test registry, test-case catalogue
- Estratégia:
  - Classificar testes por custo (fast/medium/slow) e priorizar em runs por risco

Hiperparâmetros (para LLM-assistência em geração de testes)
- Temperature: 0.2 – 0.4
- Top-p: 0.85
- Max tokens: 800

Observability
- Métricas: test_pass_rate, regression_count, average_fail_time_to_fix
- Logs: failing test stacktrace, reproduction steps

-------------------------------------------------------------------------------
Memory Management (arquitetura transversal)

Princípios
- Separate short-term (working memory) from long-term (knowledge base).
- Short-term: foco em contexto imediato, limpo frequentemente, protegido por TTL.
- Long-term: append-only logs, vector embeddings indexados, versionado.

Estrutura sugerida
- Working Memory (Redis):
  - Key: session:<agent_id>:<trace_id>
  - Value: JSON with windowed messages, embeddings pointers
  - TTL: configurable por agent_type (e.g., Orchestrator: 30m, Researcher: 2h)
- Long-term Memory (Vector DB + Postgres):
  - Vector DB stores embeddings and pointers (source_url, snippet_id)
  - Postgres stores metadata, decisions and audit records

Resumo automático (summarization pipeline)
- Trigger: when memory size exceeds X tokens or time threshold.
- Steps:
  1. Chunk context into 2–4k token windows.
  2. Run abstractive summarization model with temperature 0.0–0.2 to generate stable summaries.
  3. Validate summary length and fidelity (use extractive QA to check key facts).
  4. Persist summary to long-term store with references to original chunks.
- Example: keep last 3 summaries and 1 raw reference per topic.

Compaction & Forgetting
- LRU + priority for critical decisions; archive low-value items after 90 days.
- Provide manual pin/unpin API for human operators.

Exemplo de objeto de memória (JSON)
```json
{
  "memory_id": "mem-uuid",
  "agent_id": "researcher-42",
  "trace_id": "job-uuid",
  "created_at": "2026-02-03T12:00:00Z",
  "type": "summary",
  "content": "Resumo abstrato com 512 tokens...",
  "references": ["doc-uuid-1", "doc-uuid-2"],
  "embedding_id": "vec-12345",
  "importance_score": 0.87
}
```

-------------------------------------------------------------------------------
Workflows (3 fluxos detalhados)

Workflow A — "Feature Delivery (DevSecOps)" — Orquestrador -> Coder -> QA -> Orchestrador -> Data Analyst
Objetivo: entregar uma feature com checks de segurança e métricas de regressão.

Passos:
1. User cria um Job (JobCreated) via API Gateway (trace_id gerado).
2. Orquestrador valida input e cria tasks:
   - task.research (optional) se requisito ambíguo
   - task.code para Coder
   - task.qa para QA
   - task.metrics para Data Analyst
   (Cada task publicado em orchestration.tasks.v1)
3. Coder recebe TaskAssignment:
   - Clona repo, cria branch `feature/<job_id>`.
   - Gera implementação parcial, adiciona testes unitários.
   - Roda linters e scanners de secrets.
   - Se tudo ok, cria PR via GitHub API e publica AgentResult (status success + pr_url).
4. QA é notificado pelo Orquestrador (ou webhook do CI) para executar testes E2E.
   - QA executa testes, grava artefatos, calcula coverage.
   - Se falha, publica result partial/failed com logs; Orquestrador decide retry or reassign to Coder.
5. Data Analyst faz runs de benchmark/metrics (ex.: latência, throughput) comparando baseline.
   - Se regressão > threshold, Orquestrador bloqueia merge e solicita rework.
6. Orquestrador finaliza job com AgentResult aggregated e arquiva artifacts, emite audit event.

Considerações específicas:
- Gate de segurança (SAST) obrigatório antes de merge.
- Checkpoints persistidos em DB a cada estado mutacional (created -> in_progress -> blocked -> completed).

Workflow B — "Incident Triage & Hotfix"
Objetivo: responder rapidamente a um incidente em produção usando múltiplos agentes.

Passos:
1. Monitoring gera evento incident.created com severity.
2. Orquestrador cria task.research (root cause), task.code (hotfix), task.qa (smoke).
3. Researcher coleta logs, traces (jaeger), commit a heurísticas de rollback; publica hipóteses.
4. Coder cria hotfix branch, aplica patch minimal, executa testes unitários locais.
5. QA executa smoke tests em canary e valida rollback path.
6. Orquestrador automatiza rollback se canary falhar e emite incident.resolved ou escalates to human.
7. Post-mortem: Data Analyst compila métricas de impacto e sugere melhorias.

Tempo crítico:
- SLO de triage inicial: 5 minutos
- Hotfix deploy canary: < 30 minutos

Workflow C — "Research-driven Feature Proposal"
Objetivo: transformar uma hipótese de pesquisa em um POC (proof-of-concept).

Passos:
1. JobCreated com intent: validate-hypothesis.
2. Researcher extrai literatura e dados históricos, gera relatório com confidence scores.
3. Data Analyst valida dados, fornece dataset e experiment plan.
4. Coder prototipa POC com testes mínimos.
5. QA executa regressions e smoke; Orquestrador avalia go/no-go.
6. Se sucesso, Orquestrador cria backlog item para roadmap (persist as artifact).

Cross-cutting patterns
- All workflows must propagate trace_id.
- All tasks that modify production resources require double-approval (or automatic approval if low-risk and passes checks).

-------------------------------------------------------------------------------
Edge Cases — Tratamento de Erros e Recuperação de Estado

Tabelas de tratamento de erro (erro, causa provável, detecção, estratégia de recuperação, alert nível)

```markdown
| Erro/Evento                     | Causa provável                          | Detecção                        | Recuperação / Ação automatizada                     | Alert Nível |
|---------------------------------|-----------------------------------------|---------------------------------|-----------------------------------------------------|-------------|
| SchemaMismatch                  | Versão de produtor incompatível         | Validation error no consumer    | Reject + publish to dlq + alert operador            | high        |
| AgentTimeout                    | Latência ou deadlock no agente          | DeadlineExceeded                | Retry with backoff (3x) -> escalate to human       | high        |
| TaskIdempotencyViolation        | Duplicate processing                    | Duplicate detection (job/task)  | Drop duplicate, log incident                        | medium      |
| SecretsInCommit                 | Credenciais acidental em patch          | pre-commit check/trufflehog     | Abort PR, revert, notify author                     | critical    |
| FlakyTests                      | Non-deterministic test failures         | High variance in test runs      | Mark flaky, reduce priority, require human review   | medium      |
| DataDriftDetected               | Distribution change in input features   | Drift metric > threshold        | Trigger retrain / rollback / alert                 | high        |
| StoreUnavailable                | Object store down                       | IO errors, unhealthy checks     | Switch to fallback store, buffer events to disk     | critical    |
| PartialAgentFailure             | Agent returned partial results          | status = partial                | Re-run subtask or spawn supporting agent           | medium      |
| UnauthorizedAccess              | Token expired or permissions changed    | 401/403 on API calls            | Refresh tokens, revoke sessions, notify security   | critical    |
| AuditLogTampering               | Integrity violation                      | Signature mismatch              | Halt critical ops, forensics, revoke keys          | critical    |
```

Recuperação de estado — padrões
- Checkpoint & Replay:
  - Persistir checkpoints no DB com (job_id, state, cursor, timestamp).
  - On restart: read last checkpoint, replay events a partir de cursor.
- DLQ (Dead Letter Queue):
  - Mensagens inválidas direcionadas para DLQ com reason code e attempt_count.
  - Processo de reprocessamento manual ou via automated replay com fix-up script.
- Version pinning:
  - Conservar compatibilidade: cada job grava expected agent schema version; se dessincronizado, Orquestrador solicita downgrade/upgrade.
- Fail-open vs Fail-closed:
  - Segurança: sempre fail-closed em operações que podem expor dados ou produzir writes não autorizadas.
  - Non-critical analytics: fail-open com buffered writes.

Exemplo de estratégia de retry exponencial
- Base: 1s
- Multiplier: 2
- Max attempts: 5
- Jitter: randomized +/- 20%
- Backoff formula: delay = base * (multiplier ^ attempt) * (1 ± jitter)

-------------------------------------------------------------------------------
Parâmetros de Hiperconfiguração por Agente (Guia prático)

- Orchestrator
  - Temperature: 0.0–0.2
  - Top-p: 0.9
  - Max tokens: 800
  - Reason: determinismo alto para decisões reproducíveis.

- Researcher
  - Temperature: 0.2–0.5
  - Top-p: 0.8
  - Max tokens: 1200
  - Reason: balance entre exploratório e factual.

- Data Analyst
  - LLMS usados para summarization/explanation:
    - Temperature: 0.1–0.3
    - Top-p: 0.7
  - Prefer deterministic outputs for metric computation.

- Coder
  - Temperature: 0.0–0.2 (deterministic patches)
  - Top-p: 0.9
  - Max tokens: 1500
  - Safety: enable static analysis hooks before commit.

- QA
  - For test generation: Temperature 0.2–0.4, top_p 0.85
  - For test expectations: temperature 0.1

Observação sobre chain-of-thought
- Evitar prompt que exponha chain-of-thought internamente quando logs forem persistidos em long-term memory (por questões de segurança e privacidade). Use "explainable summary" em vez de raw chain-of-thought salvo.

-------------------------------------------------------------------------------
Anexos

Exemplos de payloads JSON (realistas)

1) Example: JobCreated
```json
{
  "id": "a1b2c3d4",
  "trace_id": "trace-1111",
  "timestamp": "2026-02-03T12:34:56.789Z",
  "version": "1.0.0",
  "source": "api-gateway",
  "destination": ["orchestrator"],
  "intent": "feature_delivery",
  "payload": {
    "schema": "JobCreated.v1",
    "job_id": "job-uuid-1234",
    "owner": "user:alice",
    "description": "Add payment provider X integration",
    "priority": "high",
    "input_refs": [
      { "type": "git", "url": "https://github.com/org/repo", "ref": "refs/heads/main" }
    ],
    "metadata": { "ci": "true", "sla_seconds": 86400 }
  }
}
```

2) Example: TaskAssignment (Coder)
```json
{
  "id": "t-assign-4321",
  "trace_id": "trace-1111",
  "timestamp": "2026-02-03T12:36:00.000Z",
  "version": "1.0.0",
  "source": "orchestrator",
  "destination": ["coder"],
  "intent": "implement_feature",
  "payload": {
    "schema": "TaskAssignment.v1",
    "task_id": "task-uuid-5678",
    "job_id": "job-uuid-1234",
    "assigned_to": "agent:coder-1",
    "task_type": "code",
    "deadline_iso": "2026-02-05T12:00:00Z",
    "context": {
      "repo": "https://github.com/org/repo",
      "issue_number": 789
    }
  }
}
```

Checklist de integração para novo agente
- [ ] Implementar validação de schema (Pydantic) para todas mensagens inbound.
- [ ] Emitir events com header padrão (id, trace_id, timestamp, version, source, destination).
- [ ] Registrar métricas Prometheus obrigatórias: processed_total, processed_failed_total, avg_latency_seconds.
- [ ] Expor healthcheck /ready e /live endpoints.
- [ ] Implementar DLQ handling e idempotency tokens.
- [ ] Suportar pin/unpin de memórias de longo prazo.

Logs e Telemetria recomendados (por mensagem)
- Correlacionar: trace_id, job_id, task_id, agent_id
- Fields:
  - level (info/warn/error)
  - event_type (task.assigned, task.completed)
  - duration_ms
  - resources_used (cpu_ms, mem_mb)
  - reason (on error)
- Retenção:
  - Traces por 90 dias, logs críticos por 1 ano.

-------------------------------------------------------------------------------
Checklist de Segurança e Compliance

- Criptografia:
  - mTLS obrigatório para todos os agentes
  - At rest: AES-256
- Segredos:
  - Vault para secrets, nunca armazenar em memória persistente
- Auditoria:
  - Todas decisões que alteram produção precisam de signature e rationale no audit log
- Governance:
  - Versionamento de modelos e datasets
  - Model Cards para modelos LLM/ML utilizados
- Privacidade:
  - PII redaction pipeline antes de qualquer persistência de logs

-------------------------------------------------------------------------------