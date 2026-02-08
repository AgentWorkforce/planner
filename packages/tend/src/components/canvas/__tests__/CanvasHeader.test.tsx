import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CanvasHeader, type SessionInfo } from '../CanvasHeader';

const mockNavigate = vi.fn();

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSessions: SessionInfo[] = [
  { id: '1', title: 'Session 1' },
  { id: '2', title: 'Session 2' },
  { id: '3', title: 'Session 3' },
];

describe('CanvasHeader', () => {
  it('renders the header with session title', () => {
    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Back to dashboard')).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
        />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByLabelText('Back to dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/ideation');
  });

  it('renders AI Understanding and Planner buttons', () => {
    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('AI Understanding')).toBeInTheDocument();
    expect(screen.getByText('→ Planner')).toBeInTheDocument();
  });

  it('renders AI Understanding button', () => {
    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('AI Understanding')).toBeInTheDocument();
  });


  it('shows dropdown when clicking session title with other sessions', () => {
    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
        />
      </BrowserRouter>
    );

    // Click to open dropdown
    fireEvent.click(screen.getByText('Session 1'));

    // Should show other sessions (not current)
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    expect(screen.getByText('Session 3')).toBeInTheDocument();
  });

  it('calls onSessionSwitch when selecting another session', () => {
    const handleSessionSwitch = vi.fn();

    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
          onSessionSwitch={handleSessionSwitch}
        />
      </BrowserRouter>
    );

    // Open dropdown
    fireEvent.click(screen.getByText('Session 1'));

    // Select another session
    fireEvent.click(screen.getByText('Session 2'));

    expect(handleSessionSwitch).toHaveBeenCalledWith('2');
  });

  it('enables inline editing on double-click', () => {
    const handleTitleChange = vi.fn();

    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
          onTitleChange={handleTitleChange}
        />
      </BrowserRouter>
    );

    const titleButton = screen.getByText('Session 1');
    fireEvent.doubleClick(titleButton);

    // Should show input field
    const input = screen.getByDisplayValue('Session 1');
    expect(input).toBeInTheDocument();

    // Change value and blur
    fireEvent.change(input, { target: { value: 'Updated Session' } });
    fireEvent.blur(input);

    expect(handleTitleChange).toHaveBeenCalledWith('Updated Session');
  });

  it('cancels edit when pressing Escape', () => {
    const handleTitleChange = vi.fn();

    render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={mockSessions}
          onTitleChange={handleTitleChange}
        />
      </BrowserRouter>
    );

    const titleButton = screen.getByText('Session 1');
    fireEvent.doubleClick(titleButton);

    const input = screen.getByDisplayValue('Session 1');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should not call onChange
    expect(handleTitleChange).not.toHaveBeenCalled();

    // Should show original title again
    expect(screen.getByText('Session 1')).toBeInTheDocument();
  });

  it('does not show dropdown arrow when there are no other sessions', () => {
    const singleSession = [{ id: '1', title: 'Session 1' }];

    const { container } = render(
      <BrowserRouter>
        <CanvasHeader
          sessionId="1"
          sessionTitle="Session 1"
          sessions={singleSession}
        />
      </BrowserRouter>
    );

    // Should not have chevron icon (svg)
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });
});
