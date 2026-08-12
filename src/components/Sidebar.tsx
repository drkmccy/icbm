import { Settings, Plus, Upload, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenImport: () => void;
}

export const Sidebar = ({ onOpenSettings, onOpenImport }: SidebarProps) => {
  const { lists, currentList, createNewList, selectList, deleteList, duplicateList } = useBookmarks();

  return (
    <div className="w-full h-full bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold font-display text-sidebar-foreground">
          I.C.B.M.
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-accent hover:text-sidebar-foreground"
            onClick={createNewList}
          >
            <Plus className="h-4 w-4" />
            New List
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-accent hover:text-sidebar-foreground"
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
                  "group flex items-center justify-between px-2 py-1.5 rounded-md transition-colors",
                  currentList?.id === list.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                )}
              >
                <span 
                  className="truncate text-sm flex-1 cursor-pointer" 
                  onClick={() => selectList(list.id)}
                >
                  {list.topLevelName}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => duplicateList(list.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteList(list.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 space-y-1 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-accent hover:text-sidebar-foreground"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
};
