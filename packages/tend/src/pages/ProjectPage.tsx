import { useParams } from 'react-router-dom';

/**
 * ProjectPage
 *
 * The workspace view for a specific project.
 * Shows the project tree, conversation pane, and agent tabs.
 *
 * @route /projects/:id
 */
export function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Project Workspace</h1>
      <p className="text-text-secondary mt-2">
        Project ID: {id}
      </p>
      <p className="text-text-muted text-sm mt-4">
        The project workspace will appear here with the tree, conversation, and agent tabs.
      </p>
    </div>
  );
}
