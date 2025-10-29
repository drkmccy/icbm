import { useState, useRef, useEffect } from 'react';
import { BookmarkItem, BookmarkFolder, BookmarkLink } from '@/types/bookmark';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { ChevronRight, ChevronDown, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const WysiwygEditor = () => {
  const { currentList, updateList, addToHistory, undo, redo } = useBookmarks();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key === 'Z') {
          e.preventDefault();
          redo();
        } else if (e.key === 'z') {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (!currentList) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No list selected</p>
          <p className="text-sm">Create a new list or select one from the sidebar</p>
        </div>
      </div>
    );
  }

  const sortRecursive = (items: BookmarkItem[]): BookmarkItem[] => {
    return items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => {
        if (item.type === 'folder') {
          return {
            ...item,
            children: sortRecursive(item.children)
          };
        }
        return item;
      });
  };

  const addFolder = (parentPath: number[] = []) => {
    const newFolder: BookmarkFolder = {
      id: uuidv4(),
      type: 'folder',
      name: 'New Folder',
      children: [],
    };

    const updatedList = { ...currentList };
    if (parentPath.length === 0) {
      updatedList.children = [...updatedList.children, newFolder];
    } else {
      let current: any = updatedList;
      for (let i = 0; i < parentPath.length - 1; i++) {
        current = current.children[parentPath[i]];
      }
      const lastIndex = parentPath[parentPath.length - 1];
      const parent = current.children[lastIndex] as BookmarkFolder;
      parent.children = [...parent.children, newFolder];
    }
    
    addToHistory(updatedList.children);
    updateList(updatedList);
  };

  const addLink = (parentPath: number[] = []) => {
    const newLink: BookmarkLink = {
      id: uuidv4(),
      type: 'link',
      name: 'New Link',
      url: 'https://',
    };

    const updatedList = { ...currentList };
    if (parentPath.length === 0) {
      updatedList.children = [...updatedList.children, newLink];
    } else {
      let current: any = updatedList;
      for (let i = 0; i < parentPath.length - 1; i++) {
        current = current.children[parentPath[i]];
      }
      const lastIndex = parentPath[parentPath.length - 1];
      const parent = current.children[lastIndex] as BookmarkFolder;
      parent.children = [...parent.children, newLink];
    }
    
    addToHistory(updatedList.children);
    updateList(updatedList);
  };

  const deleteItem = (path: number[]) => {
    const updatedList = { ...currentList };
    if (path.length === 1) {
      updatedList.children = updatedList.children.filter((_, i) => i !== path[0]);
    } else {
      let current: any = updatedList;
      for (let i = 0; i < path.length - 2; i++) {
        current = current.children[path[i]];
      }
      const parentIndex = path[path.length - 2];
      const parent = current.children[parentIndex] as BookmarkFolder;
      parent.children = parent.children.filter((_, i) => i !== path[path.length - 1]);
    }
    
    addToHistory(updatedList.children);
    updateList(updatedList);
  };

  const toggleCollapse = (path: number[]) => {
    const updatedList = { ...currentList };
    let current: any = updatedList;
    for (let i = 0; i < path.length - 1; i++) {
      current = current.children[path[i]];
    }
    const folder = current.children[path[path.length - 1]] as BookmarkFolder;
    folder.collapsed = !folder.collapsed;
    updateList(updatedList);
  };

  const updateItemName = (path: number[], name: string) => {
    const updatedList = { ...currentList };
    let current: any = updatedList;
    for (let i = 0; i < path.length - 1; i++) {
      current = current.children[path[i]];
    }
    current.children[path[path.length - 1]].name = name;
    updateList(updatedList);
  };

  const updateLinkUrl = (path: number[], url: string) => {
    const updatedList = { ...currentList };
    let current: any = updatedList;
    for (let i = 0; i < path.length - 1; i++) {
      current = current.children[path[i]];
    }
    (current.children[path[path.length - 1]] as BookmarkLink).url = url;
    updateList(updatedList);
  };

  const sortFolder = (path: number[]) => {
    const updatedList = { ...currentList };
    if (path.length === 0) {
      updatedList.children = sortRecursive(updatedList.children);
    } else {
      let current: any = updatedList;
      for (let i = 0; i < path.length - 1; i++) {
        current = current.children[path[i]];
      }
      const folder = current.children[path[path.length - 1]] as BookmarkFolder;
      folder.children = sortRecursive(folder.children);
    }
    
    addToHistory(updatedList.children);
    updateList(updatedList);
  };

  const handleDragEnd = (event: DragEndEvent, parentPath: number[]) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const updatedList = { ...currentList };
    let items: BookmarkItem[];
    
    if (parentPath.length === 0) {
      items = updatedList.children;
    } else {
      let current: any = updatedList;
      for (let i = 0; i < parentPath.length - 1; i++) {
        current = current.children[parentPath[i]];
      }
      const folder = current.children[parentPath[parentPath.length - 1]] as BookmarkFolder;
      items = folder.children;
    }

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      if (parentPath.length === 0) {
        updatedList.children = newItems;
      } else {
        let current: any = updatedList;
        for (let i = 0; i < parentPath.length - 1; i++) {
          current = current.children[parentPath[i]];
        }
        const folder = current.children[parentPath[parentPath.length - 1]] as BookmarkFolder;
        folder.children = newItems;
      }
      
      addToHistory(updatedList.children);
      updateList(updatedList);
    }
  };

  const SortableItem = ({ 
    item, 
    path, 
    depth 
  }: { 
    item: BookmarkItem; 
    path: number[]; 
    depth: number;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        {item.type === 'folder' ? 
          renderFolder(item as BookmarkFolder, path, depth, listeners) : 
          renderLink(item as BookmarkLink, path, depth, listeners)
        }
      </div>
    );
  };

  const renderFolder = (
    folder: BookmarkFolder, 
    path: number[], 
    depth: number, 
    dragHandlers?: any
  ) => {
    const isCollapsed = folder.collapsed || false;
    
    return (
      <div className="group">
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50",
            focusedId === folder.id && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          <div {...dragHandlers} className="cursor-move touch-none flex-shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <button
            onClick={() => toggleCollapse(path)}
            className="text-sm flex items-center justify-center w-4 h-4 flex-shrink-0"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <span className="text-lg cursor-pointer flex-shrink-0" onClick={() => setFocusedId(folder.id)}>
            {isCollapsed ? '📁' : '📂'}
          </span>
          <Input
            value={folder.name}
            onChange={(e) => updateItemName(path, e.target.value)}
            onFocus={() => setFocusedId(folder.id)}
            className="flex-1 min-w-0 h-7 bg-transparent border-none focus:bg-background truncate"
          />
          {!isCollapsed && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => sortFolder(path)}
                className="h-6 w-6 p-0"
                title="Sort"
              >
                ↕️
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addFolder(path)}
                className="h-6 w-6 p-0"
                title="Add Subfolder"
              >
                📂
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addLink(path)}
                className="h-6 w-6 p-0"
                title="Add Link"
              >
                🔖
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteItem(path)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {!isCollapsed && folder.children.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, path)}
          >
            <SortableContext
              items={folder.children.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {folder.children.map((child, idx) => (
                <SortableItem
                  key={child.id}
                  item={child}
                  path={[...path, idx]}
                  depth={depth + 1}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    );
  };

  const renderLink = (
    link: BookmarkLink, 
    path: number[], 
    depth: number,
    dragHandlers?: any
  ) => {
    return (
      <div
        className={cn(
          "group flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50",
          focusedId === link.id && "bg-muted"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        <div {...dragHandlers} className="cursor-move touch-none flex-shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-lg cursor-pointer flex-shrink-0" onClick={() => setFocusedId(link.id)}>
          🔖
        </span>
        <Input
          value={link.name}
          onChange={(e) => updateItemName(path, e.target.value)}
          onFocus={() => setFocusedId(link.id)}
          placeholder="Name"
          className="w-[30%] min-w-0 h-7 bg-transparent border-none focus:bg-background rounded-full truncate"
        />
        <Input
          value={link.url}
          onChange={(e) => updateLinkUrl(path, e.target.value)}
          onFocus={() => setFocusedId(link.id)}
          placeholder="URL"
          className="w-[70%] min-w-0 h-7 bg-transparent border-none focus:bg-background rounded-full truncate"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => deleteItem(path)}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };


  return (
    <div className="h-full overflow-y-auto bg-editor p-4">
      <div className="space-y-1">
        {/* Top level folder */}
        <div className="flex items-center gap-2 mb-4 p-2 rounded bg-card">
          <span className="text-2xl">📂</span>
          <Input
            ref={editingName ? inputRef : null}
            value={currentList.topLevelName}
            onChange={(e) => {
              const updated = { ...currentList, topLevelName: e.target.value };
              updateList(updated);
            }}
            onFocus={() => setEditingName(true)}
            onBlur={() => setEditingName(false)}
            className="flex-1 text-lg font-semibold bg-transparent border-none focus:bg-background"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => sortFolder([])}
              title="Sort"
            >
              ↕️
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => addFolder()}
              title="Add Subfolder"
            >
              📂
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => addLink()}
              title="Add Link"
            >
              🔖
            </Button>
          </div>
        </div>

        {/* Children */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, [])}
        >
          <SortableContext
            items={currentList.children.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {currentList.children.map((child, idx) => (
              <SortableItem
                key={child.id}
                item={child}
                path={[idx]}
                depth={0}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
