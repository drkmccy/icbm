import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';

const STORAGE_KEY = 'icbm-welcome-seen';

export const WelcomeModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-accent" />
            Hey there, friend!
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm text-muted-foreground">
              <p>
                Quick heads up before you start launching bookmarks into orbit:
                everything here runs <span className="text-foreground font-medium">right in your browser</span>.
              </p>
              <p>
                Your data lives cozily in <span className="text-foreground font-medium">localStorage</span> on
                this device. Nothing gets shipped off to a server, no analytics,
                no trackers, no shady stuff. Just you and your bookmarks.
              </p>
              <p className="text-xs italic">
                (Close this with the × or hit Esc — no buttons to click, no terms to accept.)
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
