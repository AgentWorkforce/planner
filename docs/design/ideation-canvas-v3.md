# Ideation Canvas v3: Re-ideation, Planner Loop, and Asset Ingestion

TL;DR
V3 focuses on two missing loops: (1) how users revisit and re-ideate ideas after a plan already exists, and (2) how documents/images flow into sessions as first-class inputs that strengthen blocks and understanding.

---

## Goals

- Make it clear how to revisit an idea after a plan exists (re-ideate, re-plan, or both).
- Define the planner <-> ideation feedback loop (planner requests clarification, ideation responds).
- Support drag-drop documents and images as session inputs (chat, canvas, dashboard).
- Treat assets as sources that strengthen blocks, not just raw context.

## Non-goals (v3)

- Full codebase ingestion for arbitrary repos (describe discovery flow, but not full implementation).
- Long-term asset versioning and diff UI (capture the data model, not full UX).
- Cross-project asset libraries (scope to a session or plan).

---

## Core Concepts (V3)

### Idea Session
The canonical ideation workspace for a user.

### Idea Version
A specific state of the session that can be handed off to Planner. Versions allow re-ideation without overwriting history.

### Handoff Record
A durable link between an idea version and the resulting plan (plan_id + plan_version + summary of blocks/understanding used).

### Planner Feedback Loop
Planner can return "needs clarification," which opens a targeted re-ideation task in the same session.

### Asset Ingestion
Documents/images become source artifacts. Insights derived from them are stored in understanding and referenced by blocks.

---

## Revisit + Re-ideate Journeys

### 1) Revisit an idea already handed off to Planner

Entry points:
- Dashboard: "Reopen session"
- Planner: "Back to ideation" link on plan header
- Search: session history

When reopening, show a clear state banner:

  "This idea was handed off to Planner on 2026-02-01 (Plan v3)."

Primary choices:
- Continue ideation (edit blocks, gather new info)
- Create a new plan version from this updated ideation
- View existing plan (open Planner)

Default behavior (proposed):
1) Reopen loads the last idea version with curated blocks + understanding.
2) If user edits blocks or adds sources, mark as "modified since last handoff."
3) CTA becomes "Send updates to Planner" → creates a new plan version.

Edge cases:
- If a previous plan version was rejected/superseded, surface in banner.
- If ideation diverges heavily, offer "Create new plan (fork)" vs "Update existing plan."

### 2) Revisit an idea that was not planned by the app

Entry points:
- "Start from existing product"
- Drag-drop docs or grant repo/folder access for discovery

Flow:
1) User starts a discovery session.
2) Agents ask for repo/folder access or prompt for uploads.
3) Agents extract existing-system blocks (auto-curated) plus proposed-change blocks.
4) Interviewer asks: "Do you want to plan changes, a rewrite, or a new product?"

Key point: discovery is still ideation, but seeded by observed reality rather than greenfield assumptions.

---

## Planner <-> Ideation Interface (Replan Loop)

### Planner Outcomes

Planner can emit one of:
- accepted: plan created successfully
- needs_clarification: plan cannot be created due to missing info
- rejected: plan is out of scope / unsupported

### If Planner needs clarification

Behavior:
- Create a clarification task in the ideation session
- Highlight missing items (panel or pinned message)
- Resume in focused mode with targeted questions

UX copy:
  "Planner needs clarification on: pricing model, data retention, and deployment target."

### If user initiates replan

Trigger:
- User clicks "Send updates to Planner"

Behavior:
- Create a new plan version
- Link to the idea version that produced it
- Preserve old plan versions for comparison

Edge cases:
- Planner feedback arrives after the session changed → ask which idea version to apply it to.
- Keep a plan history drawer with timestamps + version notes.

---

## Drag-Drop Docs and Images (UX + Architecture)

### Drop Targets

1) Canvas background (inside a session)
   - Attach assets to the current session
   - Start analysis immediately

2) Chat input (inside a session)
   - Treat as a message with asset references
   - Ask: "Do you want to summarize or extract requirements?"

3) Dashboard (no session open)
   - Create a shadow session and show a small prompt:
     "We created a draft session for these files. Start ideation or attach to an existing session?"

### UX Behavior

- Upon drop, show an "Asset tray" with status:
  pending -> analyzing -> ready -> failed
- Once ready, post a short summary in chat:
  "Analyzed 2 docs. Topics: auth, billing, infra."
- Blocks highlight when supported by sources (confidence boost + source icon).

### Storage + Processing (aligned with ideation-documents feature)

Reuse existing doc handler architecture:
- Documents stored as raw inputs
- Chunking and topic extraction
- Insights feed into unified Understanding
- Blocks can cite sources by topic or line range

Extend for images:
- MediaAsset table (id, session_id, filename, mime, size)
- If vision model available: generate captions + extracted text
- If not: prompt user to annotate ("What should I extract from this image?")

### Impact on Blocks

- Blocks store source references (doc + image)
- Confidence increases if multiple sources corroborate
- Sources visible in the block detail drawer with file + line range

---

## Data Model Additions (Conceptual)

- IdeaSession
  - id, title, created_at, updated_at, status
- IdeaVersion
  - id, session_id, created_at, summary_snapshot, curated_block_ids
- HandoffRecord
  - id, session_id, idea_version_id, plan_id, plan_version, created_at
- Asset (Document or Media)
  - id, session_id, type, filename, status, metadata
- BlockSource
  - block_id, source_id, source_range, confidence

---

## Edge Cases and UX Decisions

- User drops assets into dashboard but never completes session creation.
  -> Assets stay in a draft session until user chooses.
- Duplicate assets (same file hash).
  -> Prompt: "Already uploaded. Reuse or reanalyze?"
- Replan when Planner already has active tasks based on old plan.
  -> Offer "Create new plan version" vs "Fork new plan"
- Planner feedback arrives after user has branched ideation.
  -> Route feedback to the last matching handoff.

---

## Additional v3 Coverage (Concise)

- Block merge/split logic when AI detects overlap or overloaded blocks
- Uncertainty handling: curated blocks can be flagged or un-curated
- Authoring: track authorship for blocks + edits (future multi-user)
- Asset deletion: prompt to remove dependent understanding/blocks

---

## Open Questions

- Should "re-ideation" always create a new plan version, or can users reopen and edit without re-handoff?
- How should planner/forge completion change re-ideation semantics?
- How should we package assets for Planner: single zip, or "vital-only" flagged artifacts?
- What should trigger a forced clarification loop vs a suggested one?

---

## Appendix: Verbatim v3 Answers (User)

1. I dont necessarily know if a user SHOULD be able to reopen? .. should it rather be a new version? is that cleaner (like we do with planner versions if they are approved?)
2. I dont know.. AI can ask user - and user can initiate? figure it out
3. I think it should be clean 1:1? what would be the edge cases (user loops that say othervise)
4. I think its an abiity for the agents? "Which project repo or folder are you referring to? can you grant access for discovery" etc? --> then the agents undertand and build blocks for what already exists? .. so this might be a different block type (automatically appears as curated and built?)
5. txt, md, images -- pdf / zip / complex stuff for later?
6. If a user drops files into the dashboard (no session), do we auto-create a session or always prompt? <--- make a suggestion based on what you think would be both good UX, and good architecture (data is put in a shadow session "behind the scenes" -> ready if the user wants to initiate ideation?)
7. I think the AIs should be able to give sources (file + line numbers?) for what they add to understanding or blocks?
8. I think everything should be zipped and sent to the planner as a single file? Or again, maybe the ideation AIs can flag docs as vital for planner and only those get sent?

Edge cases (1 = "What changed since last handoff"?)
1. A handoff is a "contract" .. essentially "hey planner, plan out this idea fully" ... we dont send "half assed" ideas to the planner. Any delta would be perhaps if the planner has finished planning? or further downstream - if the Forge has finished building?
2. I think a block edit by the user warrants the AIs to look at it (maybe only interviewer looks - and informs relevant other agents to have a closer look)?) -- and they update the block or surrounding blocks as needed?
3. AIs should flag inconsistencies / conflicting understanding/blocks behind the scenes - and Interviewer AI should ask clarifying questions?
4. I dont know, you have to look into what the planner expects (integration / contract) and think that through what is most clean and at the same time a good experience for the user (within reason)
5. What are ideation branches? ... You mean if two ideas (each containing unfinished and curated blocks) merge? or two blocks within a single ideation session? -- If its the latter, if AI recognises that two blocks are essentially covering the same theme, they should merge them (or split, in the opposite case - if a block is trying to cover too much)
6. I guess we notify the user that we keep the file name for reference, but the doc is removed? And ask if he/she also wants to remove all understanding/block-content that reference that file?
7. I think we can both mark curated blocks as uncertain- requiring the users attention.. and also have the Interviewer AI suggest to un-curate blocks if things change a lot (curated block confidence goes down)
8. We should track authoring. Chat, and view of the blocks states would be the same for all active users if we ever implement realtime sessions for multi users?
9. I guess we at least request to do that? Or ask the user to upload relevant docs or files instead?
10. Not at the moment, but we can note the idea for later use if need be
