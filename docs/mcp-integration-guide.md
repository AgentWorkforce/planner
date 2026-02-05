# MCP Integration Guide for Planner/Forge (2026)

**Purpose:** Practical walkthrough for integrating Model Context Protocol (MCP) servers into the Planner and Orchestrator systems.

---

## Part 1: MCP Architecture for Planner

### 1.1 Why MCP for Planner?

Planner needs to understand code scope, structure, and dependencies to generate accurate steps. MCP provides:

1. **Standardized tool protocol** — Planner agents don't care whether scope inference comes from ast-grep or a custom semantic search; they call `code-search` via MCP.
2. **Pluggable backends** — Swap implementations without changing Planner code.
3. **Multi-tool composition** — Single agent can use ast-grep + Code Context + GitHub simultaneously.
4. **External tool discovery** — Runtime: "what code-understanding tools are available?"

---

### 1.2 Planner's MCP Tool Requirements

Planner agents need access to these tools (via MCP):

```yaml
tools:
  - name: code-search
    description: "Semantic + structural code search"
    params:
      query: string          # "find authentication handlers"
      codebase: string[]     # repos to search
      type: "semantic" | "structural" | "hybrid"

  - name: ast-find
    description: "Find code by AST pattern (ast-grep)"
    params:
      pattern: string        # ast-grep YAML pattern
      codebase: string[]

  - name: code-file-read
    description: "Read specific file or function"
    params:
      path: string

  - name: github-api
    description: "Query GitHub (deps, issues, etc.)"
    params:
      repo: string
      action: "list-files" | "get-readme" | "list-deps"
```

---

### 1.3 MCP Server Architecture

```
Planner Service
    ├─ MCPClient (internal)
    │   ├─ stdio connection → ast-grep-mcp-server
    │   ├─ stdio connection → code-context-mcp-server
    │   └─ HTTP connection → github-mcp-server
    │
    └─ PlannerLead Agent (uses MCPClient)
        └─ LLM integration
```

**Key:** MCP servers are **long-lived processes** spawned at Planner startup, not per-request.

---

## Part 2: Implementing MCP Servers

### 2.1 ast-grep MCP Server (TypeScript Template)

**File:** `packages/forge-core/src/mcp-servers/ast-grep.ts`

```typescript
import { MCPServer, Tool } from "@mcp/sdk";
import { execSync } from "child_process";
import * as path from "path";

export function createAstGrepServer(workspaceRoot: string): MCPServer {
  const server = new MCPServer({
    name: "ast-grep",
    version: "1.0.0"
  });

  // Define tools
  const tools: Tool[] = [
    {
      name: "find",
      description: "Find code matching an AST pattern (ast-grep)",
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "AST pattern (YAML format)"
          },
          codebase: {
            type: "array",
            items: { type: "string" },
            description: "Paths to search (repos, directories)"
          },
          limit: {
            type: "number",
            description: "Max results",
            default: 50
          }
        },
        required: ["pattern", "codebase"]
      }
    },
    {
      name: "patterns",
      description: "List built-in patterns (auth, global-access, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["auth", "globals", "api", "db", "unsafe"]
          }
        }
      }
    }
  ];

  server.setToolDefinitions(tools);

  // Handle tool calls
  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "find") {
      return await handleFind(args, workspaceRoot);
    } else if (name === "patterns") {
      return await handlePatterns(args);
    }

    return { error: `Unknown tool: ${name}` };
  });

  return server;
}

async function handleFind(args: any, workspaceRoot: string) {
  const { pattern, codebase, limit = 50 } = args;

  try {
    // Build sg command
    const paths = codebase
      .map((p) => path.join(workspaceRoot, p))
      .join(" ");

    const cmd = `sg --pattern '${pattern}' --json ${paths} | head -n ${limit}`;

    const output = execSync(cmd, { encoding: "utf-8" });
    const results = output
      .split("\n")
      .filter((l) => l)
      .map((l) => JSON.parse(l));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`
        }
      ]
    };
  }
}

async function handlePatterns(args: any) {
  const patterns: Record<string, Record<string, string>> = {
    auth: {
      "find-login-handlers":
        "(function_declaration name: (identifier) @name) .where { name.text =~ /login|auth|session/ }",
      "find-password-checks":
        "(call_expression function: (identifier) @name) .where { name.text =~ /hash|check.*password/ }"
    },
    globals: {
      "direct-global-access":
        "(member_expression object: (identifier) @obj) .where { obj.text == 'global' }",
      "implicit-global":
        "(assignment_expression left: (identifier) @var) .where { @var.parent.type != 'var_declaration' }"
    }
  };

  const { category } = args;

  if (category && patterns[category]) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(patterns[category], null, 2)
        }
      ]
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(patterns, null, 2)
      }
    ]
  };
}
```

**Usage in Planner Agent:**

```typescript
// In PlannerLead
const scopePatterns = await astGrepMcp.callTool("patterns", {
  category: "auth"
});

const authCode = await astGrepMcp.callTool("find", {
  pattern: scopePatterns["find-login-handlers"],
  codebase: ["packages/api", "packages/web"]
});

// Now Planner knows where auth code is, can scope steps accordingly
```

---

### 2.2 Code Context MCP Server (Semantic Search)

**File:** `packages/forge-core/src/mcp-servers/code-context.ts`

```typescript
import { MCPServer } from "@mcp/sdk";
import { EmbeddingService } from "@/services/embedding-service";

export function createCodeContextServer(
  embeddingService: EmbeddingService
): MCPServer {
  const server = new MCPServer({
    name: "code-context",
    version: "1.0.0"
  });

  const tools = [
    {
      name: "semantic-search",
      description: "Find code by semantic meaning",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language query: 'where is auth handled?'"
          },
          codebase: {
            type: "array",
            items: { type: "string" },
            description: "Repos to search"
          },
          limit: { type: "number", default: 20 }
        },
        required: ["query", "codebase"]
      }
    }
  ];

  server.setToolDefinitions(tools);

  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "semantic-search") {
      return await semanticSearch(args, embeddingService);
    }

    return { error: `Unknown tool: ${name}` };
  });

  return server;
}

async function semanticSearch(
  args: any,
  embeddingService: EmbeddingService
) {
  const { query, codebase, limit } = args;

  try {
    // 1. Embed the query
    const queryEmbedding = await embeddingService.embed(query);

    // 2. Search vector DB for similar code
    const results = await embeddingService.searchSimilar(queryEmbedding, {
      codebase,
      limit
    });

    // 3. Enrich with code context
    const enriched = results.map((r) => ({
      file: r.file,
      function: r.function,
      snippet: r.code,
      similarity: r.score,
      repo: r.repo
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(enriched, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`
        }
      ]
    };
  }
}
```

---

### 2.3 GitHub MCP Server (Metadata & Deps)

**File:** `packages/forge-core/src/mcp-servers/github.ts`

```typescript
import { MCPServer } from "@mcp/sdk";
import { Octokit } from "@octokit/rest";

export function createGitHubServer(token: string): MCPServer {
  const github = new Octokit({ auth: token });
  const server = new MCPServer({
    name: "github",
    version: "1.0.0"
  });

  const tools = [
    {
      name: "get-readme",
      description: "Fetch README for context about a repo",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" }
        },
        required: ["owner", "repo"]
      }
    },
    {
      name: "list-dependencies",
      description: "Get package.json or equivalent for a repo",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" }
        },
        required: ["owner", "repo"]
      }
    },
    {
      name: "list-issues",
      description: "Find related issues (helpful for context)",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          labels: { type: "array", items: { type: "string" } }
        },
        required: ["owner", "repo"]
      }
    }
  ];

  server.setToolDefinitions(tools);

  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get-readme") {
      return await getReadme(github, args);
    } else if (name === "list-dependencies") {
      return await listDependencies(github, args);
    } else if (name === "list-issues") {
      return await listIssues(github, args);
    }

    return { error: `Unknown tool: ${name}` };
  });

  return server;
}

async function getReadme(github: Octokit, args: any) {
  try {
    const { owner, repo } = args;
    const { data } = await github.repos.getReadme({ owner, repo });
    return {
      content: [
        {
          type: "text",
          text: Buffer.from(data.content, "base64").toString("utf-8")
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `README not found: ${error.message}`
        }
      ]
    };
  }
}

async function listDependencies(github: Octokit, args: any) {
  try {
    const { owner, repo } = args;
    const { data } = await github.repos.getContent({
      owner,
      repo,
      path: "package.json"
    });
    return {
      content: [
        {
          type: "text",
          text: Buffer.from(data.content, "base64").toString("utf-8")
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Dependencies not found: ${error.message}`
        }
      ]
    };
  }
}

async function listIssues(github: Octokit, args: any) {
  try {
    const { owner, repo, labels = [] } = args;
    const { data } = await github.issues.listForRepo({
      owner,
      repo,
      labels: labels.join(","),
      state: "all"
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            data.map((i) => ({
              number: i.number,
              title: i.title,
              state: i.state,
              labels: i.labels.map((l: any) => l.name)
            })),
            null,
            2
          )
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing issues: ${error.message}`
        }
      ]
    };
  }
}
```

---

## Part 3: MCP Client Integration

### 3.1 MCPClient Service (Planner)

**File:** `packages/forge-core/src/services/mcp-client.ts`

```typescript
import { MCPClient as BaseMCPClient } from "@mcp/sdk";
import { StdioClientTransport } from "@mcp/sdk";
import * as path from "path";

export class MCPClient {
  private clients: Map<string, BaseMCPClient> = new Map();
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Initialize MCP servers (called at service startup)
   */
  async initialize() {
    // Start ast-grep server
    await this.startServer("ast-grep", {
      command: "npx",
      args: ["@ast-grep/cli", "serve"]
    });

    // Start code-context server (custom)
    await this.startServer("code-context", {
      command: "node",
      args: [path.join(__dirname, "../mcp-servers/code-context.js")]
    });

    // Start GitHub server (custom)
    if (process.env.GITHUB_TOKEN) {
      await this.startServer("github", {
        command: "node",
        args: [path.join(__dirname, "../mcp-servers/github.js")]
      });
    }
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      return result;
    } catch (error) {
      console.error(`[MCP] ${serverName}/${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Discover available tools on a server
   */
  async getTools(serverName: string): Promise<any[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    return await client.listTools();
  }

  /**
   * Private: start an MCP server
   */
  private async startServer(
    name: string,
    config: { command: string; args: string[] }
  ) {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args
      });

      const client = new BaseMCPClient({
        name: "planner",
        version: "1.0.0"
      });

      await client.connect(transport);

      this.clients.set(name, client);
      console.log(`[MCP] Connected to ${name}`);
    } catch (error) {
      console.error(`[MCP] Failed to start ${name}:`, error);
      // Graceful degradation: server optional
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    for (const [name, client] of this.clients) {
      await client.close();
      console.log(`[MCP] Disconnected from ${name}`);
    }
  }
}
```

---

### 3.2 Usage in PlannerLead Agent

**File:** `packages/forge-core/src/agents/planner-lead.ts`

```typescript
import { MCPClient } from "@/services/mcp-client";

export class PlannerLead {
  private mcp: MCPClient;
  private llm: ClaudeAPI;

  constructor(mcp: MCPClient, llm: ClaudeAPI) {
    this.mcp = mcp;
    this.llm = llm;
  }

  /**
   * Generate a plan from user intent
   */
  async generatePlan(intent: string): Promise<PlanVersion> {
    // Step 1: Discover scopes using MCP tools
    const scopes = await this.discoverScopes(intent);

    // Step 2: Get context for each scope
    const scopeContext = await Promise.all(
      scopes.map((scope) => this.getScopeContext(scope))
    );

    // Step 3: Use LLM to generate plan
    const plan = await this.llm.generate({
      messages: [
        {
          role: "system",
          content: `You are a planning assistant. Generate a detailed plan for: "${intent}"`
        },
        {
          role: "user",
          content: `Affected scopes and context:\n${JSON.stringify(scopeContext, null, 2)}`
        }
      ],
      tools: [
        {
          type: "mcp",
          name: "ast-grep/find",
          description: "Find code matching a pattern"
        },
        {
          type: "mcp",
          name: "code-context/semantic-search",
          description: "Find code by meaning"
        }
      ]
    });

    return plan;
  }

  /**
   * Discover affected scopes using MCP
   */
  private async discoverScopes(intent: string): Promise<string[]> {
    // Use semantic search to find related code
    const results = await this.mcp.callTool(
      "code-context",
      "semantic-search",
      {
        query: intent,
        codebase: ["packages/api", "packages/web", "packages/db"],
        limit: 20
      }
    );

    // Extract unique repos from results
    const scopes = new Set<string>();
    for (const result of results) {
      scopes.add(result.repo);
    }

    return Array.from(scopes);
  }

  /**
   * Get context for a scope (readme, deps, structure)
   */
  private async getScopeContext(scope: string): Promise<object> {
    const [owner, repo] = scope.split("/");

    const [readme, deps] = await Promise.all([
      this.mcp.callTool("github", "get-readme", { owner, repo }),
      this.mcp.callTool("github", "list-dependencies", { owner, repo })
    ]);

    return {
      scope,
      readme: readme.substring(0, 500), // Summary
      dependencies: deps
    };
  }

  /**
   * Refine plan based on feedback
   */
  async refinePlan(plan: PlanVersion, feedback: string): Promise<PlanVersion> {
    // Use MCP tools to validate feedback against code
    const issues = await this.validateFeedback(plan, feedback);

    // Generate refined plan
    const refined = await this.llm.generate({
      messages: [
        {
          role: "system",
          content: "You are refining a plan based on feedback."
        },
        {
          role: "user",
          content: `Original plan:\n${JSON.stringify(plan, null, 2)}\n\nFeedback:\n${feedback}\n\nValidation issues:\n${issues.join("\n")}`
        }
      ]
    });

    return refined;
  }

  /**
   * Validate feedback against actual code
   */
  private async validateFeedback(
    plan: PlanVersion,
    feedback: string
  ): Promise<string[]> {
    const issues: string[] = [];

    // Example: User says "add OAuth to auth-service"
    // Validate: does auth-service exist?
    for (const step of plan.steps) {
      if (!step.scope) continue;

      try {
        await this.mcp.callTool("github", "get-readme", {
          owner: step.scope.split("/")[0],
          repo: step.scope.split("/")[1]
        });
      } catch {
        issues.push(`Scope not found: ${step.scope}`);
      }
    }

    return issues;
  }
}
```

---

## Part 4: Deployment & Operations

### 4.1 Docker Compose for Local Development

**File:** `docker-compose.dev.yml`

```yaml
version: "3.8"

services:
  planner-core:
    build: .
    ports:
      - "3000:3000"
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      MCP_SERVERS: "ast-grep,code-context,github"
    depends_on:
      - embedding-service

  embedding-service:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - ./data/qdrant:/qdrant/storage

  # Optional: Local Chroma (lighter than Qdrant for dev)
  chroma:
    image: ghcr.io/chroma-core/chroma:latest
    ports:
      - "8000:8000"
    environment:
      PERSIST_DIRECTORY: /chroma/data
      ANONYMIZED_TELEMETRY: "false"
    volumes:
      - ./data/chroma:/chroma/data
```

---

### 4.2 MCP Server Logging & Monitoring

**File:** `packages/forge-core/src/services/mcp-monitor.ts`

```typescript
export class MCPMonitor {
  private metrics = {
    callCount: new Map<string, number>(),
    errorCount: new Map<string, number>(),
    avgLatency: new Map<string, number[]>()
  };

  /**
   * Wrap MCP call with logging
   */
  async wrapCall<T>(
    serverName: string,
    toolName: string,
    call: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const key = `${serverName}/${toolName}`;

    try {
      const result = await call();
      const latency = Date.now() - startTime;

      // Update metrics
      this.metrics.callCount.set(
        key,
        (this.metrics.callCount.get(key) || 0) + 1
      );

      const latencies = this.metrics.avgLatency.get(key) || [];
      latencies.push(latency);
      this.metrics.avgLatency.set(
        key,
        latencies.slice(-100) // Keep last 100
      );

      console.log(`[MCP] ${key} completed in ${latency}ms`);
      return result;
    } catch (error) {
      this.metrics.errorCount.set(
        key,
        (this.metrics.errorCount.get(key) || 0) + 1
      );
      console.error(`[MCP] ${key} failed:`, error);
      throw error;
    }
  }

  /**
   * Get metrics for observability
   */
  getMetrics() {
    const summary = {};
    for (const [key, count] of this.metrics.callCount) {
      const latencies = this.metrics.avgLatency.get(key) || [];
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      summary[key] = {
        calls: count,
        errors: this.metrics.errorCount.get(key) || 0,
        avgLatency: Math.round(avgLatency)
      };
    }
    return summary;
  }
}
```

---

### 4.3 Production Checklist

- [ ] MCP servers run as systemd services (not docker-compose)
- [ ] Graceful restart on MCP server failure (reconnect logic)
- [ ] MCP call timeout (30s default, configurable per tool)
- [ ] Logging: all MCP calls logged with request/response (for debugging)
- [ ] Monitoring: track MCP latency, error rates (alert if >5% errors)
- [ ] Authentication: GITHUB_TOKEN and other secrets via env (not code)
- [ ] Rate limiting: add backoff for repeated failures

---

## Part 5: Testing MCP Integration

### 5.1 Unit Test Template

**File:** `packages/forge-core/src/__tests__/mcp-client.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MCPClient } from "@/services/mcp-client";

describe("MCPClient", () => {
  let mcp: MCPClient;

  beforeAll(async () => {
    mcp = new MCPClient();
    await mcp.initialize();
  });

  afterAll(async () => {
    await mcp.shutdown();
  });

  it("should discover ast-grep patterns", async () => {
    const patterns = await mcp.callTool("ast-grep", "patterns", {
      category: "auth"
    });

    expect(patterns).toHaveProperty("find-login-handlers");
  });

  it("should find code matching pattern", async () => {
    const results = await mcp.callTool("ast-grep", "find", {
      pattern:
        "(function_declaration name: (identifier) @name) .where { name.text =~ /auth/ }",
      codebase: ["packages/api"]
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty("file");
  });

  it("should semantic search", async () => {
    const results = await mcp.callTool("code-context", "semantic-search", {
      query: "where is authentication handled?",
      codebase: ["packages/api"]
    });

    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("similarity");
    }
  });

  it("should handle errors gracefully", async () => {
    try {
      await mcp.callTool("unknown-server", "unknown-tool", {});
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error.message).toContain("MCP server not found");
    }
  });
});
```

---

### 5.2 Integration Test: Planner Scope Inference

**File:** `packages/forge-core/src/__tests__/planner-lead.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { PlannerLead } from "@/agents/planner-lead";
import { MCPClient } from "@/services/mcp-client";

describe("PlannerLead Scope Inference", () => {
  it("should infer scopes from intent", async () => {
    const mcp = new MCPClient();
    const planner = new PlannerLead(mcp, mockLLM);

    // Mock intent
    const intent = "Add OAuth authentication";

    // Get scopes
    const scopes = await planner.discoverScopes(intent);

    expect(scopes).toContain("packages/api");
    expect(scopes).toContain("packages/web");
  });

  it("should validate scopes against actual repos", async () => {
    const mcp = new MCPClient();
    const planner = new PlannerLead(mcp, mockLLM);

    const scope = "packages/api";
    const context = await planner.getScopeContext(scope);

    expect(context).toHaveProperty("readme");
    expect(context).toHaveProperty("dependencies");
  });
});
```

---

## Part 6: Common Patterns

### 6.1 Scope Inference Pattern

**Most Common Use Case:**

```typescript
// User: "Add email notifications to sign-up flow"
// Planner discovers:

const intent = "Add email notifications to sign-up flow";

// 1. Semantic search
const codeMatches = await mcp.callTool("code-context", "semantic-search", {
  query: intent,
  codebase: allRepos
});

// 2. Identify scopes
const scopes = new Set(codeMatches.map((c) => c.repo));
// → ["packages/auth", "packages/email", "packages/web"]

// 3. Validate each scope
for (const scope of scopes) {
  const structureMatch = await mcp.callTool("ast-grep", "find", {
    pattern: "(function_declaration)",
    codebase: [scope]
  });
  if (structureMatch.length === 0) {
    scopes.delete(scope); // Invalid scope
  }
}

// 4. Generate steps scoped correctly
const plan = await llm.generatePlan({
  intent,
  scopes: Array.from(scopes),
  context: codeMatches
});
```

---

### 6.2 Acceptance Criteria Validation Pattern

**After Step Execution:**

```typescript
// Step completed. Validate against criteria.

const criteria = [
  {
    id: "ac-001",
    description: "Email sent on sign-up",
    type: "functional"
  },
  {
    id: "ac-002",
    description: "No hardcoded email addresses",
    type: "code-quality"
  }
];

// Check for hardcoded emails
const hardcodedEmails = await mcp.callTool("ast-grep", "find", {
  pattern: '(string_literal . ".*@.*\\..*")',
  codebase: stepAffectedFiles
});

if (hardcodedEmails.length > 0) {
  return {
    status: "FAILED",
    failedCriteria: [
      { id: "ac-002", reason: "Hardcoded emails found", violations: hardcodedEmails }
    ]
  };
}
```

---

## Summary

**Key Takeaways for MCP Integration:**

1. **Start with 3 MCP servers:** ast-grep, code-context, github
2. **MCPClient is a service**, not a per-request utility
3. **Servers are long-lived processes** spawned at startup
4. **Graceful degradation:** if a server is unavailable, continue with reduced capabilities
5. **Log all MCP calls** for debugging (developers will need to understand tool behavior)
6. **Test MCP integration early** — vector DB and semantic search are the hardest parts

**Next Steps:**

1. Implement ast-grep MCP server (Week 1)
2. Integrate MCPClient into PlannerLead (Week 2)
3. Write integration tests (Week 3)
4. Deploy to staging with monitoring (Week 4)
5. Integrate code-context MCP once embedding infrastructure is ready (Phase 2)

