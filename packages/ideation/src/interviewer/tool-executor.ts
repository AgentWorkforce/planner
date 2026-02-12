/**
 * Interviewer Tool Executor
 *
 * Executes tools by calling storage/API.
 */

import type { IdeationStorage } from '../storage/index.js';
import type { PlannerClient } from '../api/handlers.js';
import { createTranscriptMessage, createPlannerSend, createActiveSpecialist } from '../domain/index.js';
import { ideationEvents } from '../api/events.js';
import type {
  ToolResult,
  StartSessionInput,
  ReadSessionInput,
  UpdateUnderstandingInput,
  SendToPlannerInput,
  SpawnSpecialistInput,
  UpdateSynthesisInput,
  ListBlocksInput,
  GraduateBlocksInput,
  ReportAgentStatusInput,
  ReportToolUseInput,
} from './tools.js';

// =============================================================================
// Tool Executor
// =============================================================================

export interface ToolExecutorDeps {
  storage: IdeationStorage;
  spawnAgent?: (sessionId: string, name: string, focus: string, context?: string) => Promise<string>;
  plannerClient?: PlannerClient;
  reportStatus?: (agentId: string, state: string, options?: { activity?: string; thought?: string }) => void;
}

export async function executeTool(
  name: string,
  input: unknown,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { storage, spawnAgent, plannerClient } = deps;

  try {
    switch (name) {
      case 'start_session': {
        const { initial_intent, initiative_id } = input as StartSessionInput;
        const session = await storage.createSession(
          { type: 'human', initial_intent },
          initiative_id
        );
        return { success: true, data: { session_id: session.id } };
      }

      case 'read_session': {
        const { session_id } = input as ReadSessionInput;
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }
        return { success: true, data: session };
      }

      case 'update_understanding': {
        const { session_id, specialist_name, observations } = input as UpdateUnderstandingInput;
        const session = await storage.updateUnderstanding(session_id, specialist_name, observations);
        // Emit event so SSE clients get notified
        ideationEvents.emitSessionEvent('session:understanding', session);
        return { success: true, data: { updated: true } };
      }

      case 'send_to_planner': {
        const { session_id, goal, context } = input as SendToPlannerInput;
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        if (!plannerClient) {
          return { success: false, error: 'Planner service unavailable. No planner client configured.' };
        }

        // Auto-redirect to graduate_blocks if un-graduated curated blocks exist
        const previouslyGraduatedIds = new Set<string>();
        for (const send of session.planner_sends) {
          const sendUnderstanding = (send.payload as Record<string, unknown>)?.understanding as Record<string, unknown> | undefined;
          const graduatedMeta = sendUnderstanding?._graduated_blocks as { block_ids?: string[] } | undefined;
          if (graduatedMeta?.block_ids) {
            for (const id of graduatedMeta.block_ids) {
              previouslyGraduatedIds.add(id);
            }
          }
        }

        const curatedBlocks = (session.blocks || []).filter(
          (b: Record<string, unknown>) => b.status === 'curated' && !previouslyGraduatedIds.has(b.id as string)
        );
        if (curatedBlocks.length > 0) {
          console.log(`[tool-executor] send_to_planner redirected to graduate_blocks (${curatedBlocks.length} un-graduated curated blocks found)`);
          const blockIds = curatedBlocks.map((b: Record<string, unknown>) => b.id as string);
          return executeTool(
            'graduate_blocks',
            { session_id, block_ids: blockIds },
            deps,
          );
        }

        // Build payload
        const payload = {
          goal: goal ?? session.source.initial_intent,
          context,
          source: { type: 'ideation' as const, session_id },
          understanding: session.understanding,
          initiative_id: session.initiative_id,
        };

        let result: { plan_id: string; plan_version: number };

        try {
          // Check if session already has a plan — create version instead of new plan
          const isUpdate = session.planner_sends.length > 0;

          if (isUpdate) {
            const firstSend = session.planner_sends[0]!;
            const existingPlanId = firstSend.result?.plan_id;

            if (!existingPlanId) {
              return { success: false, error: 'Previous send has no plan_id — cannot create version' };
            }

            const plannerResult = await plannerClient.createVersion({
              plan_id: existingPlanId,
              goal: payload.goal,
              context: payload.context,
              understanding: payload.understanding,
            });

            result = {
              plan_id: plannerResult.plan_id,
              plan_version: plannerResult.version,
            };
          } else {
            const plannerResult = await plannerClient.createPlan({
              goal: payload.goal,
              context: payload.context,
              source: payload.source,
              understanding: payload.understanding,
              initiative_id: payload.initiative_id,
            });

            result = {
              plan_id: plannerResult.plan_id,
              plan_version: plannerResult.version,
            };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Failed to create plan: ${message}` };
        }

        const send = createPlannerSend(payload, result);
        await storage.appendPlannerSend(session_id, send);

        // Link plan to project (fire-and-forget, don't block on failure)
        plannerClient.linkProjectPlan({ session_id, plan_id: result.plan_id }).catch(err => {
          console.warn('[tool-executor] Failed to link project to plan:', err);
        });

        return { success: true, data: result };
      }

      case 'spawn_specialist': {
        const { session_id, name, focus, prompt_context } = input as SpawnSpecialistInput;

        // Check session exists
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Check if specialist already spawned
        const existing = session.active_specialists.find(s => s.name === name);
        if (existing) {
          return {
            success: true,
            data: {
              agent_id: existing.agent_id,
              already_active: true,
              message: `${name} specialist is already active for this session. Do NOT attempt to spawn them again. Proceed to respond to the user.`,
            },
          };
        }

        // Spawn via relay (or mock)
        let agentId: string;
        if (spawnAgent) {
          agentId = await spawnAgent(session_id, name, focus, prompt_context);
        } else {
          // No spawnAgent - fail loudly
          return { success: false, error: 'Agent spawning unavailable. No spawnAgent callback configured.' };
        }

        // Record in session
        const specialist = createActiveSpecialist(name, agentId, focus);
        await storage.addActiveSpecialist(session_id, specialist);

        return { success: true, data: { agent_id: agentId, name, focus } };
      }

      case 'update_synthesis': {
        const { session_id, idea_summary, specialist_perspectives } = input as UpdateSynthesisInput;

        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Update synthesized field via storage
        const updatedSession = await storage.updateSynthesis(session_id, {
          idea_summary,
          specialist_perspectives,
        });

        // Emit SSE event for UI update
        ideationEvents.emitSessionEvent('session:synthesis_updated', updatedSession);

        return { success: true, data: { updated: true } };
      }

      case 'list_blocks': {
        const { session_id } = input as ListBlocksInput;
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }
        const blockSummaries = (session.blocks || []).map((b: Record<string, unknown>) => ({
          id: b.id,
          keyword: b.keyword || b.title || 'Untitled',
          emoji: b.emoji || '💭',
          status: b.status || 'forming',
          confidence: Math.round((b.confidence as number) || 0),
        }));
        return { success: true, data: { blocks: blockSummaries, total: blockSummaries.length } };
      }

      case 'graduate_blocks': {
        const { session_id, block_ids: providedBlockIds, scope } = input as GraduateBlocksInput;

        // Get session
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Resolve block IDs: use provided or default to all curated blocks
        const block_ids = providedBlockIds && providedBlockIds.length > 0
          ? providedBlockIds
          : (session.blocks || [])
              .filter((b: Record<string, unknown>) => b.status === 'curated')
              .map((b: Record<string, unknown>) => b.id as string);

        if (block_ids.length === 0) {
          return { success: false, error: 'No curated blocks to graduate. Curate some blocks first.' };
        }

        // Guard: prevent re-graduation of already-graduated blocks
        const alreadyGraduatedIds: string[] = [];
        for (const send of session.planner_sends) {
          const sendUnderstanding = (send.payload as Record<string, unknown>)?.understanding as Record<string, unknown> | undefined;
          const graduatedMeta = sendUnderstanding?._graduated_blocks as { block_ids?: string[] } | undefined;
          if (graduatedMeta?.block_ids) {
            for (const blockId of block_ids) {
              if (graduatedMeta.block_ids.includes(blockId)) {
                alreadyGraduatedIds.push(blockId);
              }
            }
          }
        }

        if (alreadyGraduatedIds.length > 0) {
          const uniqueIds = [...new Set(alreadyGraduatedIds)];
          return {
            success: false,
            error: `Cannot re-graduate blocks that were already sent to the planner: ${uniqueIds.join(', ')}. ` +
              `To update these blocks in the plan, send refinements as a message to the PlannerLead instead — ` +
              `the planner agent has tools to modify individual steps without overwriting the entire plan.`,
          };
        }

        // Validate all block_ids exist and are in curated/ready status
        const blocksToGraduate = [];
        const invalidBlocks = [];

        for (const blockId of block_ids) {
          const block = session.blocks.find(b => b.id === blockId);
          if (!block) {
            invalidBlocks.push({ id: blockId, reason: 'not found' });
          } else if (block.status !== 'curated' && block.status !== 'ready') {
            invalidBlocks.push({ id: blockId, reason: `invalid status: ${block.status}` });
          } else {
            blocksToGraduate.push(block);
          }
        }

        if (invalidBlocks.length > 0) {
          return {
            success: false,
            error: `Cannot graduate blocks: ${invalidBlocks.map(b => `${b.id} (${b.reason})`).join(', ')}`,
          };
        }

        if (blocksToGraduate.length === 0) {
          return { success: false, error: 'No valid blocks to graduate' };
        }

        // Convert blocks into proper plan Steps
        const steps = blocksToGraduate.map((b) => ({
          step_id: `grad-${b.id}`,
          title: (b.keyword || b.title || 'Untitled') as string,
          scope: (scope || b.specialist || undefined) as string | undefined,
          description: (b.content || '') as string,
          dependencies: [] as string[],
        }));

        // Build payload for planner with graduated blocks as steps

        // Use synthesized idea summary if available, fall back to initial intent
        const goal = session.synthesized?.idea_summary ?? session.source.initial_intent;

        // Build context from specialist perspectives if available
        const perspectives = session.synthesized?.specialist_perspectives;
        let context: string;
        if (perspectives && Object.keys(perspectives).length > 0) {
          const summaries = Object.entries(perspectives)
            .map(([name, p]) => `${name}: ${p.take}`)
            .join('. ');
          context = summaries;
        } else {
          context = `Ideation session with ${blocksToGraduate.length} blocks ready for planning`;
        }

        const payload = {
          goal,
          context,
          source: { type: 'ideation' as const, session_id: session.id },
          understanding: {
            ...session.understanding,
            _graduated_blocks: {
              block_ids: blocksToGraduate.map(b => b.id),
              graduated_count: blocksToGraduate.length,
            },
          },
          initiative_id: session.initiative_id,
          steps,
        };

        // Call planner API if client available
        if (!plannerClient) {
          return { success: false, error: 'Planner service unavailable. No planner client configured.' };
        }

        let result: { plan_id: string; plan_version: number };

        // Check if this session has already sent to planner
        const isUpdate = session.planner_sends.length > 0;

        try {
          if (isUpdate) {
            // Update existing plan with new version
            const firstSend = session.planner_sends[0]!;
            const planId = firstSend.result?.plan_id;

            if (!planId) {
              return { success: false, error: 'Cannot graduate blocks: previous send has no plan_id' };
            }

            const plannerResult = await plannerClient.createVersion({
              plan_id: planId,
              goal: payload.goal,
              context: payload.context,
              understanding: payload.understanding,
              steps: payload.steps,
            });

            result = {
              plan_id: plannerResult.plan_id,
              plan_version: plannerResult.version,
            };
          } else {
            // Create new plan with steps from graduated blocks
            const plannerResult = await plannerClient.createPlan({
              goal: payload.goal,
              context: payload.context,
              source: payload.source,
              understanding: payload.understanding,
              initiative_id: payload.initiative_id,
              steps: payload.steps,
            });

            result = {
              plan_id: plannerResult.plan_id,
              plan_version: plannerResult.version,
            };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Failed to create plan: ${message}` };
        }

        // Record the planner send
        const send = createPlannerSend(payload, result);
        await storage.appendPlannerSend(session.id, send);

        // Link plan to project (fire-and-forget)
        plannerClient.linkProjectPlan({ session_id: session.id, plan_id: result.plan_id }).catch(err => {
          console.warn('[tool-executor] Failed to link project to plan:', err);
        });

        // Emit event for graduated blocks
        ideationEvents.emitSessionEvent('session:blocks_graduated', {
          ...session,
          planner_sends: [...session.planner_sends, send],
        });

        return {
          success: true,
          data: {
            plan_id: result.plan_id,
            plan_version: result.plan_version,
            graduated_count: blocksToGraduate.length,
            block_ids: block_ids,
          },
        };
      }

      case 'report_agent_status': {
        const { session_id, state, activity, thought } = input as ReportAgentStatusInput;
        const agentId = session_id ? `Interviewer-${session_id.slice(0, 8)}` : 'interviewer';
        deps.reportStatus?.(agentId, state, { activity, thought });
        return { success: true, data: { reported: true } };
      }

      case 'report_tool_use':
        return { success: true };

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[tool-executor] Error executing tool '${name}':`, error);
    return { success: false, error: message };
  }
}
