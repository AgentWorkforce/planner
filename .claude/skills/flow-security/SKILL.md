---
name: flow-security
description: When features need security analysis - "what are the security requirements?", "review security", or feature handles auth/data/compliance. Identifies threats, documents security decisions, and flags concerns.
user-invocable: false
---
# Security Analyst: Feature → Security Assessment

**Owns**: `understanding.security`, `context.security`

## Purpose

Analyze features for security requirements before implementation:
- Identify authentication/authorization needs
- Assess data sensitivity and handling
- Flag compliance requirements (GDPR, SOC2, etc.)
- Document security decisions and concerns

## Prerequisites

Requires: `summary` section (from brainstorm or discover).

If no summary → "Run /flow brainstorm or /flow discover first."

## Approach

**Be thorough but pragmatic.** Not every feature needs extensive security review. Focus on:
- Auth flows
- Data storage/transmission
- External integrations
- User-facing inputs

## Workflow

### 1. Assess Feature Risk Level

| Risk | Indicators |
|------|------------|
| High | Auth, payments, PII, external APIs, admin functions |
| Medium | User data, file uploads, state changes |
| Low | Read-only, public data, internal tools |

Skip deep analysis for low-risk features—note "Low risk, no security concerns" in understanding.

### 2. Identify Threats

For medium/high risk features, consider:
- Authentication bypass
- Authorization escalation
- Data exposure (logs, errors, APIs)
- Injection (SQL, XSS, command)
- CSRF/SSRF
- Rate limiting needs

### 3. Record Security Understanding

Capture observations in `understanding.security`:

```json
"understanding": {
  "security": {
    "observations": ["Handles PII (email, name)", "External OAuth integration"],
    "keywords": ["PII", "OAuth", "tokens"],
    "concerns": ["Token storage needs encryption", "Rate limiting required"],
    "questions": ["What's the session timeout policy?"],
    "confidence": "forming"
  }
}
```

### 4. Record Security Decisions

When security requirements are determined, capture in `context.security`:

```json
"context": {
  "security": {
    "auth_method": "JWT with httpOnly cookies",
    "data_classification": "PII - encrypted at rest",
    "rate_limits": "100 req/min per user",
    "compliance": ["GDPR - data deletion required"]
  }
}
```

### 5. Flag for Plan Specification

If security decisions affect implementation, note them for flow-planner:
- "Add to step specification: auth_required, rate_limit, encryption"

## Rules

- Assess risk level before deep analysis
- Don't over-engineer security for low-risk features
- Be specific about threats—not generic warnings
- Document decisions in context for future reference
- After completion: single-sentence summary

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary`, `understanding`, `context` (from code) |
| flow-brainstorm | `summary`, `understanding`, `context` (from ideas) |
| **flow-security** | `understanding.security`, `context.security` |
| flow-ui-ux-designer | `design_spec`, `context.designer`, `understanding.designer` |
| flow-planner | `plan_implementation` (with step `specification`) |
| flow-tasks | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests`, `understanding.tester`, `context.tester` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- To plan implementation: `/flow planner`
- For UI features: `/flow design`

## Done When

- Risk level assessed
- `understanding.security` captures observations and concerns
- `context.security` captures security decisions
- High-risk items flagged for plan specification
