# Interoperability Protocols: A2A and MCP

## The Interoperability Challenge

Different agent frameworks (LangGraph, CrewAI, AutoGen, etc.) don't natively communicate with each other. Two protocols are emerging to solve this:

| Protocol | Focus | Origin | Governance |
|----------|-------|--------|------------|
| **A2A** | Agent-to-agent communication | Google (Apr 2025) | Linux Foundation |
| **MCP** | Agent-to-tool/data communication | Anthropic (Nov 2024) | Linux Foundation |

**Key insight**: They're complementary, not competing.

## A2A (Agent2Agent Protocol)

### Purpose

Enable seamless communication between AI agents **built using different frameworks, by different vendors, running on separate servers**.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Client Agent                              │
│  (LangGraph-based)                                          │
│                                                             │
│  Solicits tasks on behalf of user                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ A2A Protocol
┌─────────────────────────▼───────────────────────────────────┐
│                   Remote Agent                              │
│  (CrewAI-based)                                             │
│                                                             │
│  Carries out tasks, relays results                          │
└─────────────────────────────────────────────────────────────┘
```

### Core Data Types

#### 1. Messages

```json
{
  "id": "msg-123",
  "role": "user" | "agent",
  "parts": [
    {"type": "text", "content": "Analyze this data..."},
    {"type": "file", "uri": "data://file.csv", "mimeType": "text/csv"},
    {"type": "data", "data": {"key": "value"}}
  ],
  "metadata": {...}
}
```

#### 2. Tasks

```json
{
  "id": "task-456",
  "contextId": "ctx-789",  // Groups related exchanges
  "status": "submitted" | "working" | "completed" | "failed" | "input-required",
  "artifacts": [
    {"type": "text", "content": "Analysis result..."},
    {"type": "file", "uri": "data://result.pdf"}
  ],
  "history": [...messages...]
}
```

**Task states**:
- `submitted`: Task received
- `working`: Agent processing
- `input-required`: Needs more info from client
- `completed`: Successfully finished
- `failed`: Error occurred
- `cancelled`: Client cancelled
- `rejected`: Agent refused
- `auth-required`: Authentication needed

#### 3. Agent Cards

Self-describing manifests:

```json
{
  "name": "Research Agent",
  "description": "Specialized in gathering and analyzing information",
  "version": "1.0.0",
  "skills": [
    {
      "name": "web_search",
      "description": "Search the web for information"
    },
    {
      "name": "document_analysis",
      "description": "Analyze documents and extract insights"
    }
  ],
  "protocols": ["a2a/1.0", "mcp/1.0"],
  "security": {
    "authentication": ["oauth2", "api_key"],
    "encryption": "tls1.3"
  }
}
```

### Protocol Operations

| Operation | Purpose |
|-----------|---------|
| `SendMessage` | Initiate task or continue conversation |
| `SendStreamingMessage` | Real-time updates via SSE |
| `GetTask` | Poll for task status |

### Protocol Bindings

Three standard implementations:

1. **JSON-RPC 2.0 over HTTP**
```json
{"jsonrpc": "2.0", "method": "SendMessage", "params": {...}, "id": 1}
```

2. **gRPC with Protocol Buffers**
```protobuf
service A2A {
  rpc SendMessage(MessageRequest) returns (TaskOrMessage);
  rpc SendStreamingMessage(MessageRequest) returns (stream Event);
}
```

3. **HTTP+JSON/REST**
```
POST /message:send
GET /tasks/{taskId}
```

### Update Delivery

- **Polling**: `GET /tasks/{id}`
- **Streaming**: Server-Sent Events
- **Webhooks**: Push notifications

## MCP (Model Context Protocol)

### Purpose

Standardize how LLM applications integrate with **external tools, data sources, and services**.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       MCP Host                              │
│  (Claude Desktop, Cursor, etc.)                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   MCP Client                         │   │
│  │  (Protocol client, manages connections)              │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ JSON-RPC 2.0
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼─────┐ ┌───────▼───────┐ ┌─────▼─────────┐
│  MCP Server   │ │  MCP Server   │ │  MCP Server   │
│  (GitHub)     │ │  (Database)   │ │  (FileSystem) │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Core Primitives

#### 1. Tools (Model-controlled)

Functions the AI can call:

```json
{
  "name": "search_database",
  "description": "Search the database for records",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "limit": {"type": "integer", "default": 10}
    },
    "required": ["query"]
  }
}
```

#### 2. Resources (App-controlled)

Data the application exposes:

```json
{
  "uri": "file:///path/to/document.md",
  "mimeType": "text/markdown",
  "name": "Project README"
}
```

#### 3. Prompts (User-controlled)

Templated messages:

```json
{
  "name": "code_review",
  "description": "Review code for best practices",
  "arguments": [
    {"name": "code", "required": true},
    {"name": "language", "required": false}
  ]
}
```

### Protocol Features

- **JSON-RPC 2.0** message format
- **Stateful connections**
- **Capability negotiation**
- **Progress tracking**
- **Cancellation**
- **Error reporting**

### 2025 Updates

- **Asynchronous operations**
- **Statelessness option**
- **Server identity verification**
- **Structured JSON tool output**
- **Elicitation** (server asks user for input)
- **MCP Apps Extension** (SEP-1865): UI capabilities via sandboxed iframes

## How A2A and MCP Work Together

```
┌──────────────────────────────────────────────────────────────────┐
│                        Agent System                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Agent A                                │ │
│  │                                                             │ │
│  │  Uses MCP to access:          Uses A2A to communicate:     │ │
│  │  - Databases                   - Agent B (different vendor) │ │
│  │  - APIs                        - Agent C (different server) │ │
│  │  - File systems                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│         │ MCP                              │ A2A                 │
│         ▼                                  ▼                     │
│  ┌──────────────┐                  ┌──────────────┐             │
│  │ MCP Servers  │                  │ Remote Agent │             │
│  └──────────────┘                  └──────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

**Summary**:
- **MCP**: Agent ↔ Tools/Data (vertical integration)
- **A2A**: Agent ↔ Agent (horizontal integration)

## Relevance to Planner

### Planner as A2A Participant

Planner could expose an A2A-compatible interface:

```json
// Agent Card for Planner
{
  "name": "Plan Service",
  "description": "Creates and manages versioned execution plans",
  "skills": [
    {"name": "create_plan", "description": "Create a new plan from goal"},
    {"name": "get_plan", "description": "Retrieve an approved plan"},
    {"name": "submit_change_request", "description": "Request plan modification"}
  ]
}
```

### Orchestrator using A2A

Orchestrator could dispatch to heterogeneous agents:

```python
# Orchestrator uses A2A to coordinate agents from different vendors
async def execute_step(step: dict):
    # Find agent that can handle this role
    agent_card = await discover_agent(role=step["owner_role"])

    # Send task via A2A
    task = await a2a_client.send_message(
        agent_url=agent_card["url"],
        message={
            "role": "user",
            "parts": [{"type": "text", "content": step["description"]}]
        }
    )

    # Wait for completion
    while task["status"] in ["submitted", "working"]:
        task = await a2a_client.get_task(task["id"])
        await asyncio.sleep(1)

    return task["artifacts"]
```

### Planner using MCP for Tools

```python
# Planner could use MCP to access planning resources
mcp_client = MCPClient()

# Access project context
resources = await mcp_client.list_resources()
codebase = await mcp_client.read_resource("file:///project/src")

# Use tools for plan generation
result = await mcp_client.call_tool("analyze_codebase", {
    "path": "/project/src"
})
```

## Industry Adoption

### A2A
- 150+ organizations support
- Linux Foundation governance
- Google, SAP, Salesforce, Accenture backing

### MCP
- Adopted by OpenAI (Mar 2025)
- Google DeepMind support confirmed
- Linux Foundation (AAIF) governance
- SDKs: Python, TypeScript, C#, Java, Kotlin

## Sources

- [Google: Announcing A2A](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A GitHub](https://github.com/a2aproject/A2A)
- [Linux Foundation: A2A Launch](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Anthropic: Introducing MCP](https://www.anthropic.com/news/model-context-protocol)
- [IBM: What Is A2A Protocol?](https://www.ibm.com/think/topics/agent2agent-protocol)
