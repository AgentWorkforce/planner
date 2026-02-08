# flow-tasks skill patch

Insert this section after "## Handling Large Sets" (line 35):

```markdown
## Drift Prevention

Insert an AUDIT task every ~5 IMPLs:

| Task | Subject | Purpose |
|------|---------|---------|
| AUDIT | [AUDIT] [feature] after step X | Run /cost, check for drift, fix small issues |

AUDIT blocks the next IMPL batch. Keeps implementation on track without full POST overhead.
```

Apply to: `/Users/flysikring/.claude/skills/flow-tasks/skill.md`
