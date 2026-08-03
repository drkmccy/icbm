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
  const [topName, setTopName] = useState(currentList?.topLevelName || "");
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

  // Sync top-level name with current list
  useEffect(() => {
    if (currentList) {
      setTopName(currentList.topLevelName);
    }
  }, [currentList?.topLevelName]);

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
    
    setFocusedId(newFolder.id);
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
    
    setFocusedId(newLink.id);
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

  // --- Tree helpers for cross-folder drag & drop ---
  const collectVisibleIds = (items: BookmarkItem[]): string[] => {
    const out: string[] = [];
    const walk = (list: BookmarkItem[]) => {
      list.forEach(item => {
        out.push(item.id);
        if (item.type === 'folder' && !item.collapsed) walk(item.children);
      });
    };
    walk(items);
    return out;
  };

  const findItemById = (items: BookmarkItem[], id: string): BookmarkItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.type === 'folder') {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const removeById = (items: BookmarkItem[], id: string): BookmarkItem | null => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        return items.splice(i, 1)[0];
      }
      const item = items[i];
      if (item.type === 'folder') {
        const removed = removeById(item.children, id);
        if (removed) return removed;
      }
    }
    return null;
  };

  const insertBeside = (items: BookmarkItem[], targetId: string, item: BookmarkItem): boolean => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === targetId) {
        items.splice(i, 0, item);
        return true;
      }
      const child = items[i];
      if (child.type === 'folder' && insertBeside(child.children, targetId, item)) return true;
    }
    return false;
  };

  const insertIntoFolder = (items: BookmarkItem[], folderId: string, item: BookmarkItem): boolean => {
    for (const child of items) {
      if (child.type === 'folder') {
        if (child.id === folderId) {
          child.children.push(item);
          child.collapsed = false;
          return true;
        }
        if (insertIntoFolder(child.children, folderId, item)) return true;
      }
    }
    return false;
  };

  const containsId = (item: BookmarkItem, id: string): boolean => {
    if (item.id === id) return true;
    if (item.type === 'folder') return item.children.some(c => containsId(c, id));
    return false;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = findItemById(currentList.children, activeId);
    const overItem = findItemById(currentList.children, overId);
    if (!activeItem || !overItem) return;

    // Prevent dropping a folder into itself or one of its descendants
    if (activeItem.type === 'folder' && containsId(activeItem, overId)) return;

    const children: BookmarkItem[] = JSON.parse(JSON.stringify(currentList.children));
    const moved = removeById(children, activeId);
    if (!moved) return;

    const droppedOnFolder =
      overItem.type === 'folder' && !(overItem as BookmarkFolder).collapsed;

    const inserted = droppedOnFolder
      ? insertIntoFolder(children, overId, moved)
      : insertBeside(children, overId, moved);

    if (!inserted) return;

    const updatedList = { ...currentList, children };
    addToHistory(children);
    updateList(updatedList);
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
        {item.type === 'folder' ? (
          <FolderRow folder={item as BookmarkFolder} path={path} depth={depth} dragHandlers={listeners} />
        ) : (
          <LinkRow link={item as BookmarkLink} path={path} depth={depth} dragHandlers={listeners} />
        )}
      </div>
    );
  };

  const FolderRow = ({
    folder,
    path,
    depth,
    dragHandlers,
  }: {
    folder: BookmarkFolder;
    path: number[];
    depth: number;
    dragHandlers?: any;
  }) => {
    const [name, setName] = useState(folder.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
      setName(folder.name);
    }, [folder.name]);

    const isCollapsed = folder.collapsed || false;

    return (
      <div>
        <div
          className={cn(
            "group/item flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50 min-w-0 w-full",
            focusedId === folder.id && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          <div {...dragHandlers} data-row-action="true" className="cursor-move touch-none flex-shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <button
            onClick={() => toggleCollapse(path)}
            data-row-action="true"
            className="text-sm flex items-center justify-center w-4 h-4 flex-shrink-0"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <span className="text-lg cursor-pointer flex-shrink-0" onClick={() => setFocusedId(folder.id)}>
            {isCollapsed ? '📁' : '📂'}
          </span>
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocusedId(folder.id)}
            onBlur={() => {
              if (name !== folder.name) updateItemName(path, name);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            autoFocus={!editingName && focusedId === folder.id}
            className="flex-1 min-w-0 h-7 bg-transparent border-none focus:bg-background truncate"
          />
          <div className="ml-auto flex-shrink-0 w-[152px]">
            <div className="flex gap-1 justify-end opacity-0 group-hover/item:opacity-100 transition-opacity">
              {!isCollapsed && (
                <>
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
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteItem(path)}
                className="h-6 w-6 p-0"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {!isCollapsed && folder.children.length > 0 && (
          <>
            {folder.children.map((child, idx) => (
              <SortableItem
                key={child.id}
                item={child}
                path={[...path, idx]}
                depth={depth + 1}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  const LinkRow = ({
    link,
    path,
    depth,
    dragHandlers,
  }: {
    link: BookmarkLink;
    path: number[];
    depth: number;
    dragHandlers?: any;
  }) => {
    const [name, setName] = useState(link.name);
    const [url, setUrl] = useState(link.url);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setName(link.name);
    }, [link.name]);

    useEffect(() => {
      setUrl(link.url);
    }, [link.url]);

    return (
      <div
        className={cn(
          "group/item flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50 min-w-0 w-full",
          focusedId === link.id && "bg-muted"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        <div {...dragHandlers} data-row-action="true" className="cursor-move touch-none flex-shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-lg cursor-pointer flex-shrink-0" onClick={() => setFocusedId(link.id)}>
          🔖
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocusedId(link.id)}
            onBlur={() => {
              if (name !== link.name) updateItemName(path, name);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            placeholder="Name"
            autoFocus={!editingName && focusedId === link.id}
            className="basis-[30%] shrink-0 min-w-0 h-7 bg-transparent border-none focus:bg-background rounded-full truncate"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setFocusedId(link.id)}
            onBlur={() => {
              if (url !== link.url) updateLinkUrl(path, url);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            placeholder="URL"
            className="basis-[70%] shrink-0 min-w-0 h-7 bg-transparent border-none focus:bg-background rounded-full truncate"
          />
        </div>
        <div className="ml-auto flex-shrink-0 w-[40px] flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteItem(path)}
            className="h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };


  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-editor p-4">
      <div className="space-y-1">
        {/* Top level folder */}
        <div className="flex items-center gap-2 mb-4 p-2 rounded bg-card min-w-0 w-full">
          <span className="text-2xl">📂</span>
          <Input
            ref={editingName ? inputRef : null}
            value={topName}
            onChange={(e) => setTopName(e.target.value)}
            onFocus={() => setEditingName(true)}
            onBlur={() => {
              setEditingName(false);
              if (topName !== currentList.topLevelName) {
                const updated = { ...currentList, topLevelName: topName };
                updateList(updated);
              }
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            className="flex-1 min-w-0 mr-4 text-lg font-semibold bg-transparent border-none focus:bg-background truncate"
          />
          <div className="ml-auto flex gap-1 flex-shrink-0 w-[112px] justify-end">
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
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={collectVisibleIds(currentList.children)}
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
