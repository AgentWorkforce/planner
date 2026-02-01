import { describe, it, expect } from 'vitest';
import { REVISION_AGENT_SYSTEM_PROMPT, getRevisionAgentPrompt } from './revision-agent.js';

describe('Revision Agent System Prompt', () => {
  it('defines the revision agent role', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('You are a Revision Agent');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain(
      'specialized in analyzing change requests and creating minimal, targeted plan revisions'
    );
  });

  it('clarifies this is NOT a general planning agent', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('You are NOT a general planning agent');
  });

  it('includes change request analysis instructions', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Analyze the Change Request');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('change_request_id');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('reason');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('suggested_changes');
  });

  it('describes context the agent will receive', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Context You Will Receive');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('plan_id');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('current_version');
  });

  it('emphasizes minimal, targeted changes', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Make Minimal Changes');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('smallest possible revision');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('DO NOT:');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Rewrite the entire plan');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Add unrelated improvements');
  });

  it('lists available MCP tools', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('read_plan');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('add_step');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('edit_step');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('remove_step');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('set_dependencies');
  });

  it('describes common change request types', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Common Change Request Types');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Missing Step');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Wrong Dependencies');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Redundant Step');
  });

  it('includes workflow instructions', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Workflow');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('use `read_plan` to see the current state');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Analyze the change request reason');
  });

  it('sets clear boundaries', () => {
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Boundaries');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Do NOT modify approved versions');
    expect(REVISION_AGENT_SYSTEM_PROMPT).toContain('Do NOT make changes unrelated');
  });

  describe('getRevisionAgentPrompt', () => {
    it('returns the system prompt', () => {
      const prompt = getRevisionAgentPrompt();
      expect(prompt).toBe(REVISION_AGENT_SYSTEM_PROMPT);
    });
  });
});
