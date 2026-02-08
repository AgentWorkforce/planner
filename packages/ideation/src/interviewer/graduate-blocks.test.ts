/**
 * Graduate Blocks Tool Tests
 *
 * Tests the graduate_blocks tool functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SQLiteIdeationStorage } from '../storage/sqlite.js';
import { executeTool } from './tool-executor.js';
import { createBlock } from '../domain/block.js';
import type { PlannerClient } from '../api/handlers.js';

describe('graduate_blocks tool', () => {
  let storage: SQLiteIdeationStorage;
  let mockPlannerClient: PlannerClient;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();

    // Mock planner client
    mockPlannerClient = {
      createPlan: async (params) => ({
        plan_id: 'test-plan-123',
        version: 1,
      }),
      createVersion: async (params) => ({
        plan_id: params.plan_id,
        version: 2,
      }),
      updatePlan: async () => {},
    };
  });

  it('should graduate curated blocks to planner', async () => {
    // Create a session
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    // Add some curated blocks
    const block1 = createBlock({
      type: 'feature',
      title: 'User Authentication',
      keyword: 'auth',
      emoji: '🔐',
      content: '## Authentication\n\nImplement user login and registration',
      specialist: 'Architect',
      sourceContext: 'conversation',
    });
    block1.status = 'curated';
    block1.confidence = 85;

    const block2 = createBlock({
      type: 'feature',
      title: 'Data Model',
      keyword: 'database',
      emoji: '🗄️',
      content: '## Database Schema\n\nDesign the data model',
      specialist: 'DataModeller',
      sourceContext: 'conversation',
    });
    block2.status = 'ready';
    block2.confidence = 90;

    await storage.updateBlocks(session.id, [block1, block2]);

    // Graduate the blocks
    const result = await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: [block1.id, block2.id],
        scope: 'backend',
      },
      { storage, plannerClient: mockPlannerClient }
    );

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      plan_id: 'test-plan-123',
      plan_version: 1,
      graduated_count: 2,
      block_ids: [block1.id, block2.id],
    });

    // Verify planner_sends was updated
    const updatedSession = await storage.getSession(session.id);
    expect(updatedSession?.planner_sends).toHaveLength(1);
    expect(updatedSession?.planner_sends[0]?.result).toMatchObject({
      plan_id: 'test-plan-123',
      plan_version: 1,
    });
  });

  it('should create new version if session already sent to planner', async () => {
    // Create a session with existing planner send
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    // Simulate initial send to planner
    await storage.appendPlannerSend(session.id, {
      sent_at: new Date().toISOString(),
      payload: {
        goal: 'Initial goal',
        understanding: {},
      },
      result: {
        plan_id: 'existing-plan-456',
        plan_version: 1,
      },
    });

    // Add a curated block
    const block = createBlock({
      type: 'feature',
      title: 'New Feature',
      keyword: 'feature',
      emoji: '✨',
      content: '## New Feature\n\nAdd this new feature',
      specialist: 'Designer',
      sourceContext: 'conversation',
    });
    block.status = 'curated';

    await storage.updateBlocks(session.id, [block]);

    // Graduate the block
    const result = await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: [block.id],
      },
      { storage, plannerClient: mockPlannerClient }
    );

    // Should create version 2 on existing plan
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      plan_id: 'existing-plan-456',
      plan_version: 2,
      graduated_count: 1,
    });
  });

  it('should reject blocks that are not curated or ready', async () => {
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    const formingBlock = createBlock({
      type: 'feature',
      title: 'Forming Block',
      keyword: 'forming',
      emoji: '🌱',
      content: 'Still forming',
      specialist: 'Architect',
      sourceContext: 'conversation',
    });
    // Leave status as 'forming' (default)

    await storage.updateBlocks(session.id, [formingBlock]);

    const result = await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: [formingBlock.id],
      },
      { storage, plannerClient: mockPlannerClient }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid status: forming');
  });

  it('should reject non-existent block IDs', async () => {
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    const result = await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: ['non-existent-id'],
      },
      { storage, plannerClient: mockPlannerClient }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail gracefully when planner client is unavailable', async () => {
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    const block = createBlock({
      type: 'feature',
      title: 'Test Block',
      keyword: 'test',
      emoji: '🧪',
      content: 'Test content',
      specialist: 'QA',
      sourceContext: 'conversation',
    });
    block.status = 'curated';

    await storage.updateBlocks(session.id, [block]);

    // Call without planner client
    const result = await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: [block.id],
      },
      { storage } // No plannerClient
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Planner service unavailable');
  });

  it('should include graduated blocks in understanding payload', async () => {
    const session = await storage.createSession(
      { type: 'human', initial_intent: 'Test graduation' },
      undefined
    );

    const block = createBlock({
      type: 'feature',
      title: 'API Design',
      keyword: 'api',
      emoji: '🔌',
      content: '## REST API\n\nDesign RESTful endpoints',
      specialist: 'Architect',
      sourceContext: 'conversation',
    });
    block.status = 'curated';
    block.confidence = 95;

    await storage.updateBlocks(session.id, [block]);

    let capturedPayload: any;
    const spyClient: PlannerClient = {
      createPlan: async (params) => {
        capturedPayload = params;
        return { plan_id: 'plan-789', version: 1 };
      },
      createVersion: async () => ({ plan_id: 'plan-789', version: 2 }),
      updatePlan: async () => {},
    };

    await executeTool(
      'graduate_blocks',
      {
        session_id: session.id,
        block_ids: [block.id],
        scope: 'api-layer',
      },
      { storage, plannerClient: spyClient }
    );

    // Verify the payload includes graduated blocks
    expect(capturedPayload.understanding._graduated_blocks).toBeDefined();
    expect(capturedPayload.understanding._graduated_blocks.blocks).toHaveLength(1);
    expect(capturedPayload.understanding._graduated_blocks.blocks[0]).toMatchObject({
      keyword: 'api',
      title: 'API Design',
      content: '## REST API\n\nDesign RESTful endpoints',
      confidence: 95,
    });
    expect(capturedPayload.understanding._graduated_blocks.scope).toBe('api-layer');
  });
});
