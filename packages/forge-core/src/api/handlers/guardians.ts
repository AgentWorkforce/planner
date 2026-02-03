import type { Request, Response } from 'express';
import { z } from 'zod';
import type { GuardianService } from '../../services/guardian-service.js';
import type { GuardianConfig, GuardianType } from '../../config/forge-config.js';
import { GuardianConfigSchema } from '../../config/forge-config.js';

// ============================================
// Request/Response Schemas
// ============================================

export const ListGuardiansQuerySchema = z.object({
  project_id: z.string().optional(),
});

export const SpawnGuardianRequestSchema = z.object({
  project_id: z.string().min(1),
  config: GuardianConfigSchema,
  agent_name: z.string().optional(),
});

export const StopGuardianRequestSchema = z.object({
  error: z.string().optional(),
});

export const GetGuardianTrajectoryQuerySchema = z.object({
  run_id: z.string().optional(),
  from_timestamp: z.string().optional(),
  to_timestamp: z.string().optional(),
  concern_level: z.enum(['info', 'warning', 'critical']).optional(),
});

export const RecordObservationRequestSchema = z.object({
  guardian_id: z.string().uuid(),
  observation: z.string().min(1),
  concern_level: z.enum(['info', 'warning', 'critical']),
  recommendation: z.string().optional(),
  run_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  worker_agent_id: z.string().optional(),
  trigger_type: z.string().optional(),
  intervention_taken: z.string().optional(),
});

export const GenerateRetrospectiveRequestSchema = z.object({
  run_id: z.string().uuid().optional(),
});

// ============================================
// Response Types
// ============================================

export interface GuardianResponse {
  guardian_id: string;
  project_id: string;
  guardian_type: string;
  agent_name: string;
  status: string;
  shadow_targets: string[];
  speak_on: string[];
  spawned_at: string;
  stopped_at?: string;
  error?: string;
}

export interface ListGuardiansResponse {
  guardians: GuardianResponse[];
  total: number;
}

export interface SpawnGuardianResponse {
  success: boolean;
  guardian?: GuardianResponse;
  error?: string;
}

export interface GuardianEventResponse {
  event_id: string;
  project_id: string;
  guardian_type: string;
  observation: string;
  concern_level: string;
  recommendation?: string;
  timestamp: string;
  run_id?: string;
  task_id?: string;
  worker_agent_id?: string;
  trigger_type?: string;
  intervention_taken?: string;
}

export interface GuardianTrajectoryResponse {
  events: GuardianEventResponse[];
  total: number;
  concern_counts: {
    info: number;
    warning: number;
    critical: number;
  };
}

export interface RetrospectiveResponse {
  guardian_id: string;
  guardian_type: string;
  project_id: string;
  run_id?: string;
  summary: string;
  concerns: Array<{
    level: string;
    observation: string;
    recommendation?: string;
    timestamp: string;
  }>;
  assessment: string;
  recommendations: string[];
  timestamp: string;
}

// ============================================
// Handler Dependencies
// ============================================

export interface GuardianHandlerDeps {
  guardianService: GuardianService;
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for GET /guardians
 * Lists all active guardians, optionally filtered by project.
 */
export function listGuardiansHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const queryResult = ListGuardiansQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const { project_id } = queryResult.data;

      const guardians = project_id
        ? deps.guardianService.listGuardians(project_id)
        : deps.guardianService.listAllActiveGuardians();

      const response: ListGuardiansResponse = {
        guardians: guardians.map(g => ({
          guardian_id: g.guardian_id,
          project_id: g.project_id,
          guardian_type: g.guardian_type,
          agent_name: g.agent_name,
          status: g.status,
          shadow_targets: g.shadow_targets,
          speak_on: g.speak_on,
          spawned_at: g.spawned_at,
          stopped_at: g.stopped_at,
          error: g.error,
        })),
        total: guardians.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error listing guardians:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /guardians/:guardianId
 * Gets a specific guardian by ID.
 */
export function getGuardianHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const guardianId = req.params.guardianId;
      if (!guardianId) {
        res.status(400).json({ error: 'guardianId is required' });
        return;
      }

      const guardian = deps.guardianService.getGuardian(guardianId);
      if (!guardian) {
        res.status(404).json({ error: 'Guardian not found' });
        return;
      }

      const response: GuardianResponse = {
        guardian_id: guardian.guardian_id,
        project_id: guardian.project_id,
        guardian_type: guardian.guardian_type,
        agent_name: guardian.agent_name,
        status: guardian.status,
        shadow_targets: guardian.shadow_targets,
        speak_on: guardian.speak_on,
        spawned_at: guardian.spawned_at,
        stopped_at: guardian.stopped_at,
        error: guardian.error,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error getting guardian:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /guardians/:type/spawn
 * Spawns a new guardian of the specified type.
 */
export function spawnGuardianHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const type = req.params.type;
      if (!type) {
        res.status(400).json({ error: 'type is required' });
        return;
      }

      // Validate guardian type
      if (!['Security', 'Architect', 'QA', 'Compliance'].includes(type)) {
        res.status(400).json({ error: 'Invalid guardian type' });
        return;
      }

      const bodyResult = SpawnGuardianRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const { project_id, config, agent_name } = bodyResult.data;

      // Ensure config type matches URL type
      if (config.type !== type) {
        res.status(400).json({
          error: 'Config type must match URL type',
        });
        return;
      }

      const result = deps.guardianService.spawnGuardian({
        type: type as GuardianType,
        config,
        projectId: project_id,
        agentName: agent_name,
      });

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error,
        });
        return;
      }

      const response: SpawnGuardianResponse = {
        success: true,
        guardian: {
          guardian_id: result.guardian.guardian_id,
          project_id: result.guardian.project_id,
          guardian_type: result.guardian.guardian_type,
          agent_name: result.guardian.agent_name,
          status: result.guardian.status,
          shadow_targets: result.guardian.shadow_targets,
          speak_on: result.guardian.speak_on,
          spawned_at: result.guardian.spawned_at,
        },
      };

      res.status(201).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error spawning guardian:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /guardians/:guardianId/stop
 * Stops a running guardian.
 */
export function stopGuardianHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const guardianId = req.params.guardianId;
      if (!guardianId) {
        res.status(400).json({ error: 'guardianId is required' });
        return;
      }

      const bodyResult = StopGuardianRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const { error } = bodyResult.data;

      const guardian = deps.guardianService.stopGuardian(guardianId, error);
      if (!guardian) {
        res.status(404).json({ error: 'Guardian not found' });
        return;
      }

      const response: GuardianResponse = {
        guardian_id: guardian.guardian_id,
        project_id: guardian.project_id,
        guardian_type: guardian.guardian_type,
        agent_name: guardian.agent_name,
        status: guardian.status,
        shadow_targets: guardian.shadow_targets,
        speak_on: guardian.speak_on,
        spawned_at: guardian.spawned_at,
        stopped_at: guardian.stopped_at,
        error: guardian.error,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error stopping guardian:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /guardians/:type/trajectory
 * Gets the trajectory (event history) for a guardian type in a project.
 */
export function getGuardianTrajectoryHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const type = req.params.type;
      const { project_id } = req.query;

      if (!type) {
        res.status(400).json({ error: 'type is required' });
        return;
      }

      if (!project_id || typeof project_id !== 'string') {
        res.status(400).json({ error: 'project_id query parameter is required' });
        return;
      }

      // Validate guardian type
      if (!['Security', 'Architect', 'QA', 'Compliance'].includes(type)) {
        res.status(400).json({ error: 'Invalid guardian type' });
        return;
      }

      const queryResult = GetGuardianTrajectoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const events = deps.guardianService.getGuardianTrajectory(
        project_id,
        type as GuardianType
      );

      // Filter by query parameters if provided
      let filteredEvents = events;
      const { run_id, from_timestamp, to_timestamp, concern_level } = queryResult.data;

      if (run_id) {
        filteredEvents = filteredEvents.filter(e => e.run_id === run_id);
      }
      if (from_timestamp) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= from_timestamp);
      }
      if (to_timestamp) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= to_timestamp);
      }
      if (concern_level) {
        filteredEvents = filteredEvents.filter(e => e.concern_level === concern_level);
      }

      // Calculate concern counts
      const concernCounts = {
        info: filteredEvents.filter(e => e.concern_level === 'info').length,
        warning: filteredEvents.filter(e => e.concern_level === 'warning').length,
        critical: filteredEvents.filter(e => e.concern_level === 'critical').length,
      };

      const response: GuardianTrajectoryResponse = {
        events: filteredEvents.map(e => ({
          event_id: e.event_id,
          project_id: e.project_id,
          guardian_type: e.guardian_type,
          observation: e.observation,
          concern_level: e.concern_level,
          recommendation: e.recommendation,
          timestamp: e.timestamp,
          run_id: e.run_id,
          task_id: e.task_id,
          worker_agent_id: e.worker_agent_id,
          trigger_type: e.trigger_type,
          intervention_taken: e.intervention_taken,
        })),
        total: filteredEvents.length,
        concern_counts: concernCounts,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error getting guardian trajectory:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /guardians/:guardianId/observe
 * Records an observation from a guardian.
 */
export function recordObservationHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const guardianId = req.params.guardianId;
      if (!guardianId) {
        res.status(400).json({ error: 'guardianId is required' });
        return;
      }

      const bodyResult = RecordObservationRequestSchema.safeParse({
        ...req.body,
        guardian_id: guardianId,
      });
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const data = bodyResult.data;

      const event = deps.guardianService.recordObservation({
        guardianId: data.guardian_id,
        observation: data.observation,
        concernLevel: data.concern_level,
        recommendation: data.recommendation,
        runId: data.run_id,
        taskId: data.task_id,
        workerAgentId: data.worker_agent_id,
        triggerType: data.trigger_type,
        interventionTaken: data.intervention_taken,
      });

      const response: GuardianEventResponse = {
        event_id: event.event_id,
        project_id: event.project_id,
        guardian_type: event.guardian_type,
        observation: event.observation,
        concern_level: event.concern_level,
        recommendation: event.recommendation,
        timestamp: event.timestamp,
        run_id: event.run_id,
        task_id: event.task_id,
        worker_agent_id: event.worker_agent_id,
        trigger_type: event.trigger_type,
        intervention_taken: event.intervention_taken,
      };

      res.status(201).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error recording observation:', err);
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /guardians/:guardianId/retrospective
 * Generates a retrospective for a guardian.
 */
export function generateRetrospectiveHandler(deps: GuardianHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const guardianId = req.params.guardianId;
      if (!guardianId) {
        res.status(400).json({ error: 'guardianId is required' });
        return;
      }

      const bodyResult = GenerateRetrospectiveRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const { run_id } = bodyResult.data;

      const retrospective = deps.guardianService.generateRetrospective(
        guardianId,
        run_id
      );

      const response: RetrospectiveResponse = {
        guardian_id: retrospective.guardianId,
        guardian_type: retrospective.guardianType,
        project_id: retrospective.projectId,
        run_id: retrospective.runId,
        summary: retrospective.summary,
        concerns: retrospective.concerns.map(c => ({
          level: c.level,
          observation: c.observation,
          recommendation: c.recommendation,
          timestamp: c.timestamp,
        })),
        assessment: retrospective.assessment,
        recommendations: retrospective.recommendations,
        timestamp: retrospective.timestamp,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GuardianHandler] Error generating retrospective:', err);
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type ListGuardiansHandlerFn = ReturnType<typeof listGuardiansHandler>;
export type GetGuardianHandlerFn = ReturnType<typeof getGuardianHandler>;
export type SpawnGuardianHandlerFn = ReturnType<typeof spawnGuardianHandler>;
export type StopGuardianHandlerFn = ReturnType<typeof stopGuardianHandler>;
export type GetGuardianTrajectoryHandlerFn = ReturnType<typeof getGuardianTrajectoryHandler>;
export type RecordObservationHandlerFn = ReturnType<typeof recordObservationHandler>;
export type GenerateRetrospectiveHandlerFn = ReturnType<typeof generateRetrospectiveHandler>;
