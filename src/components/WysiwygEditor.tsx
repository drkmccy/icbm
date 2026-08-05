import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { BookmarkItem, BookmarkFolder, BookmarkLink } from '@/types/bookmark';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { ChevronRight, ChevronDown, Trash2, GripVertical, Folder, Bookmark } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

type DropZone = 'before' | 'inside' | 'after';

// ---------------------------------------------------------------------------
// Tiny external store so drag hover state doesn't re-render the whole tree
// ---------------------------------------------------------------------------
function createStore<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      if (next === value) return;
      value = next;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}

type Store<T> = ReturnType<typeof createStore<T>>;

interface EditorCtx {
  dropStore: Store<string | null>; // `${zone}::${id}` | 'root::' | null
  dragStore: Store<string | null>; // active dragging item id
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  editingName: boolean;
  toggleCollapse: (path: string) => void;
  updateItemName: (path: string, name: string) => void;
  updateLinkUrl: (path: string, url: string) => void;
  deleteItem: (path: string) => void;
  addFolder: (path: string) => void;
  addLink: (path: string) => void;
  sortFolder: (path: string) => void;
}

const EditorContext = createContext<EditorCtx | null>(null);
const useEditor = () => useContext(EditorContext)!;

function useDropZoneFor(id: string): DropZone | null {
  const { dropStore } = useEditor();
  return useSyncExternalStore(dropStore.subscribe, () => {
    const v = dropStore.get();
    if (!v) return null;
    const sep = v.indexOf('::');
    if (v.slice(sep + 2) !== id) return null;
    return v.slice(0, sep) as DropZone;
  });
}

function useIsDragging(id?: string) {
  const { dragStore } = useEditor();
  return useSyncExternalStore(dragStore.subscribe, () => {
    const v = dragStore.get();
    return id ? v === id : v !== null;
  });
}

// ---------------------------------------------------------------------------
// Pure tree helpers (module level — stable, never recreated)
// ---------------------------------------------------------------------------
const parsePath = (path: string): number[] => (path === '' ? [] : path.split('.').map(Number));

const sortRecursive = (items: BookmarkItem[]): BookmarkItem[] =>
  [...items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => (item.type === 'folder' ? { ...item, children: sortRecursive(item.children) } : item));

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
    if (items[i].id === id) return items.splice(i, 1)[0];
    const item = items[i];
    if (item.type === 'folder') {
      const removed = removeById(item.children, id);
      if (removed) return removed;
    }
  }
  return null;
};

const insertBeside = (
  items: BookmarkItem[],
  targetId: string,
  item: BookmarkItem,
  position: 'before' | 'after'
): boolean => {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === targetId) {
      items.splice(position === 'before' ? i : i + 1, 0, item);
      return true;
    }
    const child = items[i];
    if (child.type === 'folder' && insertBeside(child.children, targetId, item, position)) return true;
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
  if (item.type === 'folder') return item.children.some((c) => containsId(c, id));
  return false;
};

/** Flatten visible rows in render order (used to de-duplicate adjacent drop slots) */
const flattenVisible = (items: BookmarkItem[], out: BookmarkItem[] = []): BookmarkItem[] => {
  for (const item of items) {
    out.push(item);
    if (item.type === 'folder' && !item.collapsed) flattenVisible(item.children, out);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
const FolderRow = memo(
  ({
    folder,
    path,
    depth,
    dragHandlers,
  }: {
    folder: BookmarkFolder;
    path: string;
    depth: number;
    dragHandlers: any;
  }) => {
    const { focusedId, setFocusedId, editingName, toggleCollapse, updateItemName, deleteItem, addFolder, addLink, sortFolder } =
      useEditor();
    const [name, setName] = useState(folder.name);
    useEffect(() => {
      setName(folder.name);
    }, [folder.name]);

    const isCollapsed = folder.collapsed || false;

    return (
      <div
        className={cn(
          'group/item flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50 min-w-0 w-full',
          focusedId === folder.id && 'bg-muted'
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
                <Button size="sm" variant="ghost" onClick={() => sortFolder(path)} className="h-6 w-6 p-0" title="Sort">
                  ↕️
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addFolder(path)} className="h-6 w-6 p-0" title="Add Subfolder">
                  📂
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addLink(path)} className="h-6 w-6 p-0" title="Add Link">
                  🔖
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => deleteItem(path)} className="h-6 w-6 p-0" title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
FolderRow.displayName = 'FolderRow';

const LinkRow = memo(
  ({ link, path, depth, dragHandlers }: { link: BookmarkLink; path: string; depth: number; dragHandlers: any }) => {
    const { focusedId, setFocusedId, editingName, updateItemName, updateLinkUrl, deleteItem } = useEditor();
    const [name, setName] = useState(link.name);
    const [url, setUrl] = useState(link.url);

    useEffect(() => {
      setName(link.name);
    }, [link.name]);
    useEffect(() => {
      setUrl(link.url);
    }, [link.url]);

    return (
      <div
        className={cn(
          'group/item flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50 min-w-0 w-full',
          focusedId === link.id && 'bg-muted'
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
  }
);
LinkRow.displayName = 'LinkRow';

const TreeItem = memo(({ item, path, depth }: { item: BookmarkItem; path: string; depth: number }) => {
  const { attributes, listeners, setNodeRef: setDraggableRef } = useDraggable({ id: item.id });
  const { setNodeRef: setDroppableRef } = useDroppable({ id: item.id });
  const zone = useDropZoneFor(item.id);
  const isDragging = useIsDragging(item.id);

  const dragHandlers = useMemo(() => ({ ...attributes, ...listeners }), [attributes, listeners]);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    },
    [setDraggableRef, setDroppableRef]
  );

  const indent = `${depth * 1.5 + 0.5}rem`;

  return (
    <>
      <div ref={setRefs} className={cn('relative rounded', isDragging && 'opacity-30')}>
        {zone === 'before' && (
          <div className="pointer-events-none absolute left-0 right-0 -top-px z-10 h-0.5 bg-accent" style={{ marginLeft: indent }} />
        )}
        {zone === 'after' && (
          <div
            className="pointer-events-none absolute left-0 right-0 -bottom-px z-10 h-0.5 bg-accent"
            style={{ marginLeft: indent }}
          />
        )}
        <div className={cn('rounded', zone === 'inside' && 'bg-accent/25 ring-1 ring-inset ring-accent')}>
          {item.type === 'folder' ? (
            <FolderRow folder={item} path={path} depth={depth} dragHandlers={dragHandlers} />
          ) : (
            <LinkRow link={item} path={path} depth={depth} dragHandlers={dragHandlers} />
          )}
        </div>
      </div>
      {item.type === 'folder' &&
        !item.collapsed &&
        item.children.map((child, idx) => (
          <TreeItem key={child.id} item={child} path={`${path}.${idx}`} depth={depth + 1} />
        ))}
    </>
  );
});
TreeItem.displayName = 'TreeItem';

const RootDropZone = memo(() => {
  const { setNodeRef } = useDroppable({ id: 'root' });
  const zone = useDropZoneFor('root');
  const dragging = useIsDragging();
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-1 h-8 rounded border border-dashed border-transparent transition-colors',
        dragging && 'border-border',
        zone && 'border-accent bg-accent/15'
      )}
    />
  );
});
RootDropZone.displayName = 'RootDropZone';

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
export const WysiwygEditor = () => {
  const { currentList, updateList, addToHistory, undo, redo } = useBookmarks();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [topName, setTopName] = useState(currentList?.topLevelName || '');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dropStore = useRef(createStore<string | null>(null)).current;
  const pendingDropRef = useRef<string | null>(null);
  const dropFrameRef = useRef<number | null>(null);
  const dragStore = useRef(createStore<string | null>(null)).current;

  const listRef = useRef(currentList);
  listRef.current = currentList;

  const visibleOrderRef = useRef<BookmarkItem[]>([]);
  visibleOrderRef.current = useMemo(
    () => (currentList ? flattenVisible(currentList.children) : []),
    [currentList?.children]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (currentList) setTopName(currentList.topLevelName);
  }, [currentList?.topLevelName]);

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

  // --- mutations (stable) -------------------------------------------------
  const commit = useCallback(
    (children: BookmarkItem[], history = true) => {
      const list = listRef.current;
      if (!list) return;
      if (history) addToHistory(children);
      updateList({ ...list, children });
    },
    [addToHistory, updateList]
  );

  const withClone = useCallback((fn: (children: BookmarkItem[]) => boolean | void, history = true) => {
    const list = listRef.current;
    if (!list) return;
    const children: BookmarkItem[] = JSON.parse(JSON.stringify(list.children));
    const ok = fn(children);
    if (ok === false) return;
    commit(children, history);
  }, [commit]);

  const getParentArray = (children: BookmarkItem[], path: number[]): BookmarkItem[] => {
    let arr = children;
    for (let i = 0; i < path.length - 1; i++) {
      arr = (arr[path[i]] as BookmarkFolder).children;
    }
    return arr;
  };

  const addFolder = useCallback(
    (pathStr: string) => {
      const newFolder: BookmarkFolder = { id: uuidv4(), type: 'folder', name: 'New Folder', children: [] };
      withClone((children) => {
        const path = parsePath(pathStr);
        if (path.length === 0) children.push(newFolder);
        else {
          const arr = getParentArray(children, path);
          (arr[path[path.length - 1]] as BookmarkFolder).children.push(newFolder);
        }
      });
      setFocusedId(newFolder.id);
    },
    [withClone]
  );

  const addLink = useCallback(
    (pathStr: string) => {
      const newLink: BookmarkLink = { id: uuidv4(), type: 'link', name: 'New Link', url: 'https://' };
      withClone((children) => {
        const path = parsePath(pathStr);
        if (path.length === 0) children.push(newLink);
        else {
          const arr = getParentArray(children, path);
          (arr[path[path.length - 1]] as BookmarkFolder).children.push(newLink);
        }
      });
      setFocusedId(newLink.id);
    },
    [withClone]
  );

  const deleteItem = useCallback(
    (pathStr: string) => {
      withClone((children) => {
        const path = parsePath(pathStr);
        const arr = getParentArray(children, path);
        arr.splice(path[path.length - 1], 1);
      });
    },
    [withClone]
  );

  const toggleCollapse = useCallback(
    (pathStr: string) => {
      withClone((children) => {
        const path = parsePath(pathStr);
        const arr = getParentArray(children, path);
        const folder = arr[path[path.length - 1]] as BookmarkFolder;
        folder.collapsed = !folder.collapsed;
      }, false);
    },
    [withClone]
  );

  const updateItemName = useCallback(
    (pathStr: string, name: string) => {
      withClone((children) => {
        const path = parsePath(pathStr);
        const arr = getParentArray(children, path);
        arr[path[path.length - 1]].name = name;
      }, false);
    },
    [withClone]
  );

  const updateLinkUrl = useCallback(
    (pathStr: string, url: string) => {
      withClone((children) => {
        const path = parsePath(pathStr);
        const arr = getParentArray(children, path);
        (arr[path[path.length - 1]] as BookmarkLink).url = url;
      }, false);
    },
    [withClone]
  );

  const sortFolder = useCallback(
    (pathStr: string) => {
      withClone((children) => {
        const path = parsePath(pathStr);
        if (path.length === 0) {
          const sorted = sortRecursive(children);
          children.length = 0;
          children.push(...sorted);
        } else {
          const arr = getParentArray(children, path);
          const folder = arr[path[path.length - 1]] as BookmarkFolder;
          folder.children = sortRecursive(folder.children);
        }
      });
    },
    [withClone]
  );

  // --- drag & drop --------------------------------------------------------
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const collisions = pointerWithin(args);
      const pointer = args.pointerCoordinates;
      let target: string | null = null;

      if (collisions.length > 0 && pointer) {
        // prefer the smallest hit area (rows never overlap, but be safe)
        const best = [...collisions].sort((a, b) => {
          const ar = args.droppableRects.get(a.id);
          const br = args.droppableRects.get(b.id);
          return (ar ? ar.height : Infinity) - (br ? br.height : Infinity);
        })[0];

        const id = String(best.id);
        if (id === 'root') {
          target = 'root::root';
        } else {
          const rect = args.droppableRects.get(best.id);
          const item = listRef.current ? findItemById(listRef.current.children, id) : null;
          if (rect && item) {
            const ratio = (pointer.y - rect.top) / rect.height;
            let zone: DropZone;
            if (item.type === 'folder') {
              zone = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'inside';
            } else {
              zone = ratio < 0.5 ? 'before' : 'after';
            }

            // Collapse duplicate slots: "after X" and "before next(X)" are the
            // same visual gap — always canonicalise to "before next(X)".
            if (zone === 'after') {
              const order = visibleOrderRef.current;
              const idx = order.findIndex((o) => o.id === id);
              const next = idx >= 0 ? order[idx + 1] : undefined;
              if (next) {
                target = `before::${next.id}`;
              } else {
                target = `after::${id}`;
              }
            } else {
              target = `${zone}::${id}`;
            }
          }
        }
      }

      // defer: collision detection runs during DndContext's render pass
      if (target !== dropStore.get() && pendingDropRef.current !== target) {
        pendingDropRef.current = target;
        if (dropFrameRef.current === null) {
          dropFrameRef.current = requestAnimationFrame(() => {
            dropFrameRef.current = null;
            dropStore.set(pendingDropRef.current);
          });
        }
      }
      return collisions;
    },
    [dropStore]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveDragId(id);
      dragStore.set(id);
    },
    [dragStore]
  );

  const resetDragState = useCallback(() => {
    setActiveDragId(null);
    dragStore.set(null);
    dropStore.set(null);
  }, [dragStore, dropStore]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const raw = dropStore.get();
      resetDragState();
      if (!raw) return;

      const sep = raw.indexOf('::');
      const position = raw.slice(0, sep) as DropZone | 'root';
      const overId = raw.slice(sep + 2);
      const list = listRef.current;
      if (!list) return;
      if (position !== 'root' && (!overId || activeId === overId)) return;

      const activeItem = findItemById(list.children, activeId);
      if (!activeItem) return;
      if (position !== 'root' && !findItemById(list.children, overId)) return;
      if (activeItem.type === 'folder' && position !== 'root' && containsId(activeItem, overId)) return;

      const children: BookmarkItem[] = JSON.parse(JSON.stringify(list.children));
      const moved = removeById(children, activeId);
      if (!moved) return;

      let inserted = false;
      if (position === 'root') {
        children.push(moved);
        inserted = true;
      } else if (position === 'inside') {
        inserted = insertIntoFolder(children, overId, moved);
      } else {
        inserted = insertBeside(children, overId, moved, position);
      }
      if (!inserted) return;

      commit(children);
    },
    [commit, dropStore, resetDragState]
  );

  const ctx = useMemo<EditorCtx>(
    () => ({
      dropStore,
      dragStore,
      focusedId,
      setFocusedId,
      editingName,
      toggleCollapse,
      updateItemName,
      updateLinkUrl,
      deleteItem,
      addFolder,
      addLink,
      sortFolder,
    }),
    [
      dropStore,
      dragStore,
      focusedId,
      editingName,
      toggleCollapse,
      updateItemName,
      updateLinkUrl,
      deleteItem,
      addFolder,
      addLink,
      sortFolder,
    ]
  );

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

  const activeItem = activeDragId ? findItemById(currentList.children, activeDragId) : null;

  return (
    <EditorContext.Provider value={ctx}>
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
                  updateList({ ...currentList, topLevelName: topName });
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
              }}
              className="flex-1 min-w-0 mr-4 text-lg font-semibold bg-transparent border-none focus:bg-background truncate"
            />
            <div className="ml-auto flex gap-1 flex-shrink-0 w-[132px] justify-end">
              <Button size="sm" variant="ghost" onClick={() => sortFolder('')} className="h-8 w-8 p-0" title="Sort">
                ↕️
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addFolder('')} className="h-8 w-8 p-0" title="Add Subfolder">
                📂
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addLink('')} className="h-8 w-8 p-0" title="Add Link">
                🔖
              </Button>
            </div>
          </div>

          {/* Children */}
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={resetDragState}
          >
            {currentList.children.map((child, idx) => (
              <TreeItem key={child.id} item={child} path={String(idx)} depth={0} />
            ))}
            <RootDropZone />
            <DragOverlay dropAnimation={null}>
              {activeItem && (
                <div className="flex max-w-sm items-center gap-2 rounded border bg-card px-3 py-2 text-sm shadow-lg">
                  {activeItem.type === 'folder' ? (
                    <Folder className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate">{activeItem.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </EditorContext.Provider>
  );
};
