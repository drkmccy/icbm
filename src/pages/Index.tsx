import { useState } from 'react';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { Sidebar } from '@/components/Sidebar';
import { WysiwygEditor } from '@/components/WysiwygEditor';
import { CodeEditor } from '@/components/CodeEditor';
import { SettingsModal } from '@/components/SettingsModal';
import { ImportModal } from '@/components/ImportModal';
import { WelcomeModal } from '@/components/WelcomeModal';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

const Index = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <BookmarkProvider>
      <div className="h-screen w-screen flex overflow-hidden bg-background">
        {/* Sidebar - 20% */}
        <div className="w-1/5 h-full border-r border-sidebar-border">
          <Sidebar 
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenImport={() => setImportOpen(true)}
          />
        </div>

        {/* Main Area - 80% */}
        <div className="flex-1 h-full">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={50} minSize={20}>
              <WysiwygEditor />
            </ResizablePanel>
            
            <ResizableHandle className="h-1 bg-border hover:bg-accent transition-colors" />
            
            <ResizablePanel defaultSize={50} minSize={20}>
              <CodeEditor />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    </BookmarkProvider>
  );
};

export default Index;
