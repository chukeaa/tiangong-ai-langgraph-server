# TianGong AI LangGraph Server

## Install dependencies

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

nvm install
nvm alias default 20
nvm use

npm install
```

## Self deployment with Docker (LangGraph + LangSmith tracing)

Official references:
- https://docs.langchain.com/langgraph-platform/application-structure
- https://docs.langchain.com/langsmith/deploy-standalone-server
- https://docs.langchain.com/langsmith/trace-with-langgraph

### 1) Prepare env file

```bash
cp .env.self-hosted.example .env
```

Fill required secrets in `.env`, at least:
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_CHAT_MODEL_MINI`
- `LANGSMITH_API_KEY` (for tracing)

Enable LangSmith logging:
- `LANGSMITH_TRACING=true`
- `LANGSMITH_PROJECT=tiangong-ai-langgraph-server`
- `LANGSMITH_ENDPOINT=https://api.smith.langchain.com` (default SaaS endpoint)

### 2) Build LangGraph API image

```bash
npx @langchain/langgraph-cli@latest build -t tiangong-langgraph-server:local
```

### 3) Configure Nginx API key

Edit `nginx/langgraph-auth-key.conf`:

```nginx
map $http_x_api_key $langgraph_is_authorized {
  default 0;
  "your-strong-api-key" 1;
  # "your-second-key" 1;
}
```

### 4) Start services

```bash
docker compose -f docker-compose.self-hosted.yml up -d
```

If you need local Neo4j in the same stack:

```bash
docker compose -f docker-compose.self-hosted.yml --profile neo4j up -d
```

### 5) Verify server

```bash
curl http://localhost:8123/ok
# -> should return 401 without key

curl -H "X-API-Key: your-strong-api-key" http://localhost:8123/ok
# -> should return 200
```

Open LangSmith and check traces under your `LANGSMITH_PROJECT`.

## Local development server

```bash
npx @langchain/langgraph-cli@latest dev
```

## Background scripts (optional)

```bash
nohup node dist/multi_agents/kg_textbooks.js > kg_textbook.log 2>&1 &
tmux new -d -s neo4j_import 'node dist/multi_agents/kg_textbooks.js > kg_textbook.log 2>&1'
tmux kill-session -t neo4j_import
```

## Test prototype

```bash
npx ts-node src/prototype/structured_output.ts
```
