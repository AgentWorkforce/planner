import { useState } from 'react';
import { Button } from '@/components/ui';
import { PlusIcon } from '@/components/icons';
import { NewProjectModal } from './NewSessionModal';

export function NewSessionButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <PlusIcon size="sm" />
        New Session
      </Button>
      <NewProjectModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
