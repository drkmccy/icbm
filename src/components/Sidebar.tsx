import { Settings, Plus, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenImport: () => void;
}

export const Sidebar = ({ onOpenSettings, onOpenImport }: SidebarProps) => {
  const { lists, currentList, createNewList, selectList, deleteList } = useBookmarks();

  return (
    <div className="w-full h-full bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🗄️Filink
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={createNewList}
          >
            <Plus className="h-4 w-4" />
            New List
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onOpenImport}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>

        {lists.length > 0 && (
          <div className="mt-4 space-y-1">
            <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/60 uppercase">
              Your Lists
            </div>
            {lists.map((list) => (
              <div
                key={list.id}
                className={cn(
                  "group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  currentList?.id === list.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                )}
                onClick={() => selectList(list.id)}
              >
                <span className="truncate text-sm">{list.topLevelName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 space-y-1 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          ⚙️Settings
        </Button>
        
        <a
          href="https://buymeacoffee.com/drkmccy"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            ☕Buy me a coffee
          </Button>
        </a>
      </div>
    </div>
  );
};
