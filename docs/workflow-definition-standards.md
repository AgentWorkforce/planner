# Workflow Definition Standards

## Overview

Several JSON/YAML-based standards exist for defining workflows. Understanding these informs our plan format design.

## Major Standards

### 1. Serverless Workflow (CNCF)

**Governance**: Cloud Native Computing Foundation (Linux Foundation)
**Version**: 1.0.0
**SDKs**: .NET, Go, Java, PHP, Python, Rust, TypeScript

**Philosophy**: Vendor-neutral, platform-agnostic, DSL-based

**Key features**:
- Event-driven execution
- CRON scheduling
- Multiple protocol support (HTTP, gRPC, OpenAPI, AsyncAPI)
- Fault tolerance built-in

**Example**:
```yaml
id: plan-execution
name: Execute Plan Workflow
version: 1.0.0
specVersion: 1.0.0
start: fetch-plan
functions:
  - name: fetchPlan
    operation: https://planner.api/plans/{planId}
  - name: executeStep
    operation: https://orchestrator.api/execute
states:
  - name: fetch-plan
    type: operation
    actions:
      - functionRef: fetchPlan
    transition: execute-steps
  - name: execute-steps
    type: foreach
    inputCollection: "${ .plan.steps }"
    iterationParam: step
    actions:
      - functionRef:
          refName: executeStep
          arguments:
            step: "${ .step }"
    end: true
```

**Relevance**: Shows how to define stateful workflows with function references, transitions, and iteration.

### 2. Azure Logic Apps Workflow Definition Language

**Governance**: Microsoft
**Format**: JSON

**Key features**:
- Triggers (HTTP, schedule, events)
- Actions (HTTP calls, conditionals, loops)
- Connectors (pre-built integrations)

**Example**:
```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/schemas/2016-06-01/Microsoft.Logic.json",
    "triggers": {
      "manual": {
        "type": "Request",
        "kind": "Http"
      }
    },
    "actions": {
      "Fetch_Plan": {
        "type": "Http",
        "inputs": {
          "method": "GET",
          "uri": "https://planner.api/plans/@{triggerBody()['planId']}"
        },
        "runAfter": {}
      },
      "Execute_Steps": {
        "type": "Foreach",
        "foreach": "@body('Fetch_Plan')['steps']",
        "actions": {
          "Execute_Step": {
            "type": "Http",
            "inputs": {
              "method": "POST",
              "uri": "https://orchestrator.api/execute",
              "body": "@items('Execute_Steps')"
            }
          }
        },
        "runAfter": {
          "Fetch_Plan": ["Succeeded"]
        }
      }
    }
  }
}
```

**Relevance**: Shows explicit `runAfter` for dependencies, action types, and enterprise patterns.

### 3. Google Cloud Workflows

**Governance**: Google
**Format**: YAML/JSON

**Key features**:
- Step-based execution
- Expression evaluation
- Conditional branching
- Parallel execution
- Subworkflows

**Example**:
```yaml
main:
  params: [planId]
  steps:
    - fetchPlan:
        call: http.get
        args:
          url: ${"https://planner.api/plans/" + planId}
        result: plan
    - executeSteps:
        for:
          value: step
          in: ${plan.body.steps}
          steps:
            - executeStep:
                call: http.post
                args:
                  url: https://orchestrator.api/execute
                  body: ${step}
```

**Relevance**: Clean YAML syntax, expression language for dynamic values.

### 4. FlowSpec (AI Automation Workflows)

**Governance**: Community
**Format**: JSON

**Purpose**: Lightweight standard for AI-driven automation workflows

**Schema structure**:
```json
{
  "workflowTitle": "Plan Execution",
  "workflowDescription": "Execute an approved plan",
  "globalTransitions": {
    "rerun": true,
    "humanIntervention": true
  },
  "steps": [
    {
      "stepTitle": "Fetch Plan",
      "stepId": "fetch-plan",
      "stepDescription": "Retrieve the approved plan",
      "action": "http.get",
      "parameters": {
        "url": "https://planner.api/plans/{{planId}}"
      },
      "results": {
        "plan": "The fetched plan object"
      },
      "transitions": {
        "success": "execute-steps",
        "fail": "notify-error",
        "rerun": "fetch-plan",
        "human_needed": "manual-review"
      }
    }
  ]
}
```

**Relevance**: Explicitly designed for AI workflows, includes human intervention patterns.

### 5. GitHub Actions Workflow

**Governance**: GitHub
**Format**: YAML

**Key features**:
- Jobs with dependencies (`needs`)
- Steps within jobs
- Conditional execution (`if`)
- Matrix strategies (parallel variations)

**Example**:
```yaml
name: Execute Plan
on:
  workflow_dispatch:
    inputs:
      plan_id:
        required: true

jobs:
  fetch-plan:
    runs-on: ubuntu-latest
    outputs:
      steps: ${{ steps.fetch.outputs.steps }}
    steps:
      - id: fetch
        run: |
          plan=$(curl -s "https://planner.api/plans/${{ inputs.plan_id }}")
          echo "steps=$(echo $plan | jq -c '.steps')" >> $GITHUB_OUTPUT

  execute-steps:
    needs: fetch-plan
    runs-on: ubuntu-latest
    strategy:
      matrix:
        step: ${{ fromJson(needs.fetch-plan.outputs.steps) }}
    steps:
      - run: |
          curl -X POST "https://orchestrator.api/execute" \
            -d '${{ toJson(matrix.step) }}'
```

**Relevance**: Shows job-level dependencies (`needs`), parallel execution via matrix.

### 6. Apache Airflow DAG

**Governance**: Apache Foundation
**Format**: Python DSL

**Key features**:
- Operators (task types)
- Dependencies via `>>` or `set_downstream`
- Trigger rules
- Task groups

**Example**:
```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

def fetch_plan(plan_id):
    # Fetch and return plan
    pass

def execute_step(step):
    # Execute step
    pass

with DAG('execute_plan', start_date=datetime(2026, 1, 1)) as dag:
    fetch = PythonOperator(
        task_id='fetch_plan',
        python_callable=fetch_plan,
        op_args=['{{ dag_run.conf["plan_id"] }}']
    )

    # Dynamic task generation would require more complex patterns
    steps = ['step1', 'step2', 'step3']
    previous = fetch
    for step in steps:
        task = PythonOperator(
            task_id=f'execute_{step}',
            python_callable=execute_step,
            op_args=[step]
        )
        previous >> task
        previous = task
```

**Relevance**: Shows DAG-based dependency model, but highlights limitation of static task definitions.

## Common Patterns Across Standards

### 1. Step/Task Definition

All standards define discrete units of work:
- **Serverless Workflow**: `states`
- **Azure Logic Apps**: `actions`
- **Google Workflows**: `steps`
- **FlowSpec**: `steps`
- **GitHub Actions**: `jobs` and `steps`
- **Airflow**: `tasks` (operators)

### 2. Dependencies

All express "this must complete before that":
- **Serverless Workflow**: `transition` property
- **Azure Logic Apps**: `runAfter`
- **Google Workflows**: Sequential by default
- **FlowSpec**: `transitions.success`
- **GitHub Actions**: `needs`
- **Airflow**: `>>` operator

### 3. Inputs/Outputs

Data flow between steps:
- **Serverless Workflow**: `${ .expression }` syntax
- **Azure Logic Apps**: `@body('StepName')`
- **Google Workflows**: `${variable}` expressions
- **FlowSpec**: `{{variable}}` templates
- **GitHub Actions**: `${{ outputs }}`
- **Airflow**: XCom push/pull

### 4. Conditional Execution

Branching based on conditions:
- **Serverless Workflow**: `switch` state type
- **Azure Logic Apps**: `If` action type
- **Google Workflows**: `switch` step
- **FlowSpec**: `transitions` with multiple targets
- **GitHub Actions**: `if` conditions
- **Airflow**: `BranchPythonOperator`

### 5. Iteration/Parallelism

Executing over collections:
- **Serverless Workflow**: `foreach` state
- **Azure Logic Apps**: `Foreach` action
- **Google Workflows**: `for` loops, `parallel` branches
- **FlowSpec**: Not explicit
- **GitHub Actions**: `matrix` strategy
- **Airflow**: `expand()` for dynamic tasks

## Implications for Planner

### Our Plan Format Should Support

1. **Steps with unique IDs** (universal)
2. **Explicit dependencies** (DAG structure)
3. **Step descriptions** (what to do)
4. **Acceptance criteria** (how to verify)
5. **Role requirements** (who can do it)
6. **Gates** (human approval points)

### We Should NOT Mandate

1. **Execution semantics** (let Orchestrator decide)
2. **Retry policies** (Orchestrator concern)
3. **Timeout values** (Orchestrator concern)
4. **Specific tool calls** (Agent concern)

### Recommended Format

```typescript
interface PlanVersion {
  plan_id: string;
  version: number;
  status: 'draft' | 'review' | 'approved' | 'published';

  summary: {
    goal: string;
    context?: string;
  };

  steps: Step[];

  created_at: string;
  updated_at: string;
}

interface Step {
  step_id: string;
  title: string;
  description: string;

  // Dependencies (DAG)
  dependencies: string[];  // step_ids

  // Who should do this
  owner_role: string;

  // How to verify completion
  acceptance_criteria: AcceptanceCriterion[];

  // Optional human gate
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };

  // Optional priority
  priority?: 1 | 2 | 3;

  // Orchestrator-specific hints (optional)
  metadata?: Record<string, unknown>;
}

interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: 'test' | 'review' | 'metric' | 'manual';
}
```

### Why This Format

1. **Minimal** - Only what Planner needs to define
2. **Universal** - Maps to all major frameworks
3. **Extensible** - `metadata` for orchestrator-specific needs
4. **Human-readable** - Clear structure, natural language descriptions
5. **Versionable** - Supports immutable snapshots with diffs

## Sources

- [Serverless Workflow](https://serverlessworkflow.io/)
- [Azure Logic Apps Schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema)
- [Google Cloud Workflows JSON Schema](https://cloud.google.com/workflows/docs/use-workflows-json-schema-with-ide)
- [FlowSpec GitHub](https://github.com/woodyhayday/FlowSpec)
- [GitHub Actions YAML Schema](https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/github-workflow.json)
- [Airflow DAG Documentation](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
