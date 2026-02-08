import { useToast } from '@/hooks/useToast';
import { Button } from './Button';

/**
 * Example component demonstrating toast notification usage
 *
 * To use toasts in your components:
 *
 * 1. Import the hook:
 *    import { useToast } from '@/hooks/useToast';
 *
 * 2. Call the hook in your component:
 *    const { toast } = useToast();
 *
 * 3. Show a toast notification:
 *    toast({
 *      title: "Success!",
 *      description: "Your action completed successfully",
 *      variant: "success"
 *    });
 *
 * The Toaster component must be added to App.tsx (already done).
 */
export function ToastExample() {
  const { toast } = useToast();

  const showSuccess = () => {
    toast({
      title: 'Success',
      description: 'Your changes have been saved successfully',
      variant: 'success',
    });
  };

  const showError = () => {
    toast({
      title: 'Error',
      description: 'Failed to save changes. Please try again.',
      variant: 'error',
    });
  };

  const showInfo = () => {
    toast({
      title: 'Information',
      description: 'This is an informational message',
      variant: 'info',
    });
  };

  const showWarning = () => {
    toast({
      title: 'Warning',
      description: 'Please review your input before continuing',
      variant: 'warning',
    });
  };

  const showMultiple = () => {
    toast({
      title: 'First notification',
      variant: 'info',
    });

    setTimeout(() => {
      toast({
        title: 'Second notification',
        variant: 'success',
      });
    }, 500);

    setTimeout(() => {
      toast({
        title: 'Third notification',
        variant: 'warning',
      });
    }, 1000);
  };

  const showLongMessage = () => {
    toast({
      title: 'Long message example',
      description:
        'This is a longer message to demonstrate how the toast handles multiple lines of text. The component should expand to fit the content while maintaining good visual hierarchy.',
      variant: 'info',
      duration: 5000, // Show for 5 seconds
    });
  };

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Toast Notification Examples</h2>

      <div className="flex flex-wrap gap-2">
        <Button onClick={showSuccess} variant="default">
          Show Success
        </Button>

        <Button onClick={showError} variant="default">
          Show Error
        </Button>

        <Button onClick={showInfo} variant="default">
          Show Info
        </Button>

        <Button onClick={showWarning} variant="default">
          Show Warning
        </Button>

        <Button onClick={showMultiple} variant="default">
          Show Multiple
        </Button>

        <Button onClick={showLongMessage} variant="default">
          Show Long Message
        </Button>
      </div>

      <div className="mt-8 p-4 bg-bg-secondary rounded-lg">
        <h3 className="font-semibold mb-2">Usage Example:</h3>
        <pre className="text-sm text-text-muted overflow-x-auto">
          {`import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast({
        title: "Saved successfully",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "error"
      });
    }
  };

  return <button onClick={handleSave}>Save</button>;
}`}
        </pre>
      </div>
    </div>
  );
}
