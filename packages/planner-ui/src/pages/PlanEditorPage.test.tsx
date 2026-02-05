import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlanEditorPage } from './PlanEditorPage';
import type { Plan, PlanVersion } from '@/types';

// Mock API functions
vi.mock('@/api', () => ({
  getPlan: vi.fn(),
  updatePlan: vi.fn(),
  getComments: vi.fn().mockResolvedValue({ comments: [] }),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
  unresolveComment: vi.fn(),
  submitVersion: vi.fn(),
  approveVersion: vi.fn(),
  publishVersion: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

// Mock hooks
vi.mock('@/hooks', () => ({
  usePlanEvents: vi.fn().mockReturnValue({
    subscribe: vi.fn(() => vi.fn()),
    isConnected: true,
  }),
}));

// Mock useUserTrajectory hook
vi.mock('@/hooks/useUserTrajectory', () => ({
  useUserTrajectory: vi.fn().mockReturnValue({
    decisions: [],
    preferences: [],
    isLoading: false,
    error: null,
  }),
}));

// Mock MessagingSidebar to avoid RelayProvider dependency
vi.mock('@/components/MessagingSidebar', () => ({
  MessagingSidebar: () => null,
}));

import {
  getPlan,
  submitVersion,
  approveVersion,
  publishVersion,
} from '@/api';

function createMockPlan(
  status: 'draft' | 'approved' | 'published' = 'draft',
  submittedAt?: string,
  approvalInfo?: { approver: string; approved_at: string }
): { plan: Plan; version: PlanVersion } {
  return {
    plan: {
      plan_id: 'test-plan-123',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    version: {
      plan_id: 'test-plan-123',
      version: 1,
      status,
      submitted_at: submittedAt,
      approval_info: approvalInfo,
      summary: {
        goal: 'Test goal',
        context: 'Test context',
      },
      steps: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

function renderWithRouter(planId: string = 'test-plan-123') {
  return render(
    <MemoryRouter initialEntries={[`/plans/${planId}`]}>
      <Routes>
        <Route path="/plans/:planId" element={<PlanEditorPage />} />
        <Route path="/plans" element={<div>Plans List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlanEditorPage - Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkflowActions rendering', () => {
    it('renders WorkflowActions in plan header', async () => {
      const mockData = createMockPlan('draft');
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test goal')).toBeInTheDocument();
      });

      // WorkflowActions should render - check for status badge (displays status in uppercase)
      expect(screen.getByText(/draft/i)).toBeInTheDocument();
    });
  });

  describe('button visibility per status', () => {
    it('shows Submit button for draft plan without submitted_at', async () => {
      const mockData = createMockPlan('draft');
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
      });
    });

    it('shows Approve button for submitted draft plan', async () => {
      const mockData = createMockPlan('draft', '2026-01-01T12:00:00Z');
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });
    });

    it('shows Publish button for approved plan', async () => {
      const mockData = createMockPlan('approved');
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
      });
    });

    it('shows Published badge for published plan', async () => {
      const mockData = createMockPlan('published');
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        // WorkflowActions shows "published" status badge and "Ready for Orchestrator" text separately
        expect(screen.getByText(/published/i)).toBeInTheDocument();
        expect(screen.getByText(/ready for orchestrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('API callback wiring', () => {
    it('calls submitVersion API when Submit button clicked', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('draft');
      const submittedVersion = {
        ...mockData.version,
        submitted_at: '2026-01-01T12:00:00Z',
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(submitVersion).mockResolvedValue({ version: submittedVersion });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit for review/i }));

      await waitFor(() => {
        expect(submitVersion).toHaveBeenCalledWith('test-plan-123', 1);
      });
    });

    it('calls approveVersion API when Approve confirmed', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('draft', '2026-01-01T12:00:00Z');
      const approvedVersion = {
        ...mockData.version,
        status: 'approved' as const,
        approval_info: {
          approver: 'Test User',
          approved_at: '2026-01-01T13:00:00Z',
        },
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(approveVersion).mockResolvedValue({ version: approvedVersion });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
      });

      // Click Approve to open modal
      await user.click(screen.getByRole('button', { name: /^approve$/i }));

      // Wait for modal to appear (check for the modal-specific heading)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Approve Plan' })).toBeInTheDocument();
      });

      // Clear and enter approver name
      const nameInput = screen.getByPlaceholderText('Enter your name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Test Reviewer');

      // Click Approve Plan button in modal (use getAllByRole and select the button)
      const approveButtons = screen.getAllByRole('button', { name: /approve plan/i });
      await user.click(approveButtons[0]);

      await waitFor(() => {
        expect(approveVersion).toHaveBeenCalledWith('test-plan-123', 1, 'Test Reviewer');
      });
    });

    it('calls publishVersion API when Publish button clicked', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('approved');
      const publishedVersion = {
        ...mockData.version,
        status: 'published' as const,
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(publishVersion).mockResolvedValue({ version: publishedVersion, plan_ref: 'test-plan-123:1' });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /publish/i }));

      await waitFor(() => {
        expect(publishVersion).toHaveBeenCalledWith('test-plan-123', 1);
      });
    });
  });

  describe('version state updates', () => {
    it('updates UI after successful submit', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('draft');
      const submittedVersion = {
        ...mockData.version,
        submitted_at: '2026-01-01T12:00:00Z',
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(submitVersion).mockResolvedValue({ version: submittedVersion });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit for review/i }));

      // After submit, the Approve button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
      });
    });

    it('updates UI after successful approval', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('draft', '2026-01-01T12:00:00Z');
      const approvedVersion = {
        ...mockData.version,
        status: 'approved' as const,
        approval_info: {
          approver: 'Test User',
          approved_at: '2026-01-01T13:00:00Z',
        },
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(approveVersion).mockResolvedValue({ version: approvedVersion });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^approve$/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Approve Plan' })).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Enter your name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Test User');
      // Click Approve Plan button in modal (use getAllByRole and select the button)
      const approveButtons = screen.getAllByRole('button', { name: /approve plan/i });
      await user.click(approveButtons[0]);

      // After approval, the Publish button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
      });
    });

    it('updates UI after successful publish', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('approved');
      const publishedVersion = {
        ...mockData.version,
        status: 'published' as const,
      };
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(publishVersion).mockResolvedValue({ version: publishedVersion, plan_ref: 'test-plan-123:1' });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /publish/i }));

      // After publish, the Published badge should appear
      await waitFor(() => {
        expect(screen.getByText(/published/i)).toBeInTheDocument();
        expect(screen.getByText(/ready for orchestrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('approval info display', () => {
    it('shows approval info after plan is approved', async () => {
      const mockData = createMockPlan('approved', undefined, {
        approver: 'John Doe',
        approved_at: '2026-01-15T10:30:00Z',
      });
      vi.mocked(getPlan).mockResolvedValue(mockData);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/approved by john doe/i)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when submit fails', async () => {
      const user = userEvent.setup();
      const mockData = createMockPlan('draft');
      vi.mocked(getPlan).mockResolvedValue(mockData);
      vi.mocked(submitVersion).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /submit for review/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });
});
