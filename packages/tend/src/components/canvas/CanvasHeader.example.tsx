import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CanvasHeader, type SessionInfo } from './CanvasHeader';

/**
 * Example: CanvasHeader Component
 *
 * Demonstrates the CanvasHeader with all features:
 * - Back navigation
 * - Inline title editing
 * - Session switching dropdown
 * - Specialist presence indicators
 * - AI Understanding button
 * - Planner handoff button
 */

const mockSessions: SessionInfo[] = [
  { id: '1', title: 'E-commerce redesign' },
  { id: '2', title: 'Mobile app MVP' },
  { id: '3', title: 'Marketing automation' },
  { id: '4', title: 'User onboarding flow' },
];

export function CanvasHeaderExample() {
  const [currentSessionId, setCurrentSessionId] = useState('1');
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({
    '1': 'E-commerce redesign',
    '2': 'Mobile app MVP',
    '3': 'Marketing automation',
    '4': 'User onboarding flow',
  });

  const updatedSessions = mockSessions.map((s) => ({
    ...s,
    title: sessionTitles[s.id] || s.title,
  }));

  const handleTitleChange = (newTitle: string) => {
    console.log('Title changed:', newTitle);
    setSessionTitles({
      ...sessionTitles,
      [currentSessionId]: newTitle,
    });
  };

  const handleSessionSwitch = (sessionId: string) => {
    console.log('Switching to session:', sessionId);
    setCurrentSessionId(sessionId);
  };

  const handleOpenUnderstanding = () => {
    console.log('Opening AI Understanding drawer...');
  };

  const handleHandoff = () => {
    console.log('Initiating handoff to Planner...');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <CanvasHeader
          sessionId={currentSessionId}
          sessionTitle={sessionTitles[currentSessionId] || ''}
          sessions={updatedSessions}
          onTitleChange={handleTitleChange}
          onSessionSwitch={handleSessionSwitch}
          onOpenUnderstanding={handleOpenUnderstanding}
          onHandoff={handleHandoff}
        />

        {/* Demo instructions */}
        <div className="max-w-3xl mx-auto mt-8 p-6 space-y-4">
          <h2 className="text-2xl font-bold">CanvasHeader Component Demo</h2>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Features:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Click "← Back" to navigate to /ideation (will log navigation)</li>
              <li>Click session title to see other sessions in dropdown</li>
              <li>Double-click session title to edit inline</li>
              <li>Press Enter to save, Escape to cancel</li>
              <li>Click specialist avatars to open focused AI Understanding</li>
              <li>Hover specialists to see status (idle, thinking, contributing)</li>
              <li>Click "AI Understanding" to trigger callback</li>
              <li>Click "→ Planner" to trigger handoff callback</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Current State:</h3>
            <div className="p-4 bg-muted rounded-md">
              <p>
                <strong>Session ID:</strong> {currentSessionId}
              </p>
              <p>
                <strong>Session Title:</strong> {sessionTitles[currentSessionId]}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Try it:</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click the session title dropdown to switch sessions</li>
              <li>Double-click the title to rename it</li>
              <li>Open the browser console to see callback logs</li>
            </ol>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default CanvasHeaderExample;
