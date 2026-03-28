import { useState, useEffect } from 'react';
import { AIUnderstandingDrawer } from './AIUnderstandingDrawer';

/**
 * Example: Basic Usage
 */
export function BasicExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative h-screen">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-cyan text-white rounded-md"
      >
        Open AI Understanding
      </button>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-123"
        synthesized={{
          idea_summary:
            'Building a task management system with real-time collaboration features. The system will support multiple users, task assignments, deadlines, and progress tracking.',
          specialist_perspectives: {
            architect: {
              take: 'REST API fits well with CRUD operations. Consider GraphQL for complex queries. Real-time features will need WebSocket support.',
              concerns: ['Scaling concerns with concurrent users', 'Real-time updates architecture'],
              confidence: 'forming',
            },
            designer: {
              take: 'Simple form flow works well for MVP. Kanban board view is a natural fit. Mobile-first approach recommended.',
              concerns: ['Mobile UX needs careful consideration', 'Dark mode support'],
              confidence: 'confident',
            },
            engineer: {
              take: 'Tech stack is reasonable for MVP. TypeScript + React + Node.js is solid. Consider using Prisma for type-safe database access.',
              concerns: ['Test coverage strategy', 'CI/CD pipeline setup'],
              confidence: 'forming',
            },
          },
        }}
      />
    </div>
  );
}

/**
 * Example: Empty State (No Data Yet)
 */
export function EmptyStateExample() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative h-screen">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-cyan text-white rounded-md"
      >
        Open AI Understanding
      </button>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-456"
        // No synthesized data provided - shows empty state
      />
    </div>
  );
}

/**
 * Example: Minimal Data (Only Summary)
 */
export function MinimalDataExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative h-screen">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-cyan text-white rounded-md"
      >
        Open AI Understanding
      </button>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-789"
        synthesized={{
          idea_summary: 'A simple note-taking app with markdown support.',
        }}
      />
    </div>
  );
}

/**
 * Example: All Confidence Levels
 */
export function ConfidenceLevelsExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative h-screen">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-cyan text-white rounded-md"
      >
        Open AI Understanding
      </button>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-abc"
        synthesized={{
          idea_summary:
            'An e-commerce platform with inventory management and payment processing.',
          specialist_perspectives: {
            architect: {
              take: 'Microservices architecture makes sense here. Separate services for inventory, payments, and orders.',
              concerns: ['Service discovery', 'API gateway complexity'],
              confidence: 'exploring',
            },
            security: {
              take: 'PCI compliance is critical. Use established payment processors like Stripe. Implement rate limiting and fraud detection.',
              concerns: ['Data encryption at rest', 'Secure session management'],
              confidence: 'forming',
            },
            devops: {
              take: 'Kubernetes for orchestration. Use managed database services. Implement proper monitoring and alerting.',
              concerns: [],
              confidence: 'confident',
            },
          },
        }}
      />
    </div>
  );
}

/**
 * Example: Controlled Open/Close with Keyboard Shortcuts
 */
export function KeyboardControlExample() {
  const [isOpen, setIsOpen] = useState(false);

  // Toggle with Cmd+U or Ctrl+U
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative h-screen">
      <div className="p-4">
        <p className="text-sm text-text-muted mb-4">
          Press <kbd className="px-2 py-1 bg-bg-hover rounded">Cmd+U</kbd> to toggle drawer
        </p>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="px-4 py-2 bg-accent-cyan text-white rounded-md"
        >
          Toggle AI Understanding
        </button>
      </div>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-kbd"
        synthesized={{
          idea_summary: 'A calendar app with smart scheduling.',
          specialist_perspectives: {
            product: {
              take: 'Focus on MVP: basic calendar view, event creation, and reminders. Google Calendar integration is essential.',
              concerns: ['Feature prioritization', 'User onboarding flow'],
              confidence: 'confident',
            },
          },
        }}
      />
    </div>
  );
}

/**
 * Example: Many Specialists
 */
export function ManySpecialistsExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative h-screen">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-cyan text-white rounded-md"
      >
        Open AI Understanding
      </button>

      <AIUnderstandingDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sessionId="session-many"
        synthesized={{
          idea_summary:
            'A comprehensive healthcare platform with patient records, appointment scheduling, telemedicine, and billing.',
          specialist_perspectives: {
            architect: {
              take: 'HIPAA compliance requires careful architecture. Event-driven design for audit logs. Multi-tenant isolation is critical.',
              concerns: ['Data residency requirements', 'Scalability for peak hours'],
              confidence: 'forming',
            },
            designer: {
              take: 'Accessibility is paramount. WCAG 2.1 AA minimum. Consider elderly users and disabilities. Clear information hierarchy.',
              concerns: ['Mobile responsiveness', 'Print-friendly views for records'],
              confidence: 'confident',
            },
            engineer: {
              take: 'Use battle-tested frameworks. Consider FHIR standards for interoperability. Invest in automated testing early.',
              concerns: ['Integration testing complexity', 'Third-party API reliability'],
              confidence: 'forming',
            },
            security: {
              take: 'HIPAA, GDPR, and local healthcare regulations. End-to-end encryption for sensitive data. Comprehensive audit logging.',
              concerns: [
                'PHI data access controls',
                'Breach notification procedures',
                'Staff training requirements',
              ],
              confidence: 'exploring',
            },
            devops: {
              take: 'Blue-green deployments for zero downtime. Disaster recovery plan with RTO < 1 hour. Regular security audits.',
              concerns: ['Backup strategy', 'Database migration rollback'],
              confidence: 'confident',
            },
            qa: {
              take: 'End-to-end testing for critical flows. Load testing for appointment scheduling. Security testing for PHI access.',
              concerns: ['Test data management', 'Environment parity'],
              confidence: 'forming',
            },
            product: {
              take: 'Phased rollout: 1) Patient portal, 2) Scheduling, 3) Telemedicine, 4) Billing. Focus on patient experience first.',
              concerns: ['Provider adoption', 'Training materials', 'Change management'],
              confidence: 'confident',
            },
            researcher: {
              take: 'Conduct user research with both patients and healthcare providers. Understand existing workflows before disrupting.',
              concerns: ['Recruitment challenges', 'IRB approval for studies'],
              confidence: 'exploring',
            },
          },
        }}
      />
    </div>
  );
}
