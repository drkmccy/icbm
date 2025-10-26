import { useState, useRef, useEffect } from 'react';
import { BookmarkItem, BookmarkFolder, BookmarkLink } from '@/types/bookmark';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export const WysiwygEditor = () => {
  const { currentList, updateList, addToHistory } = useBookmarks();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

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

  const renderItem = (item: BookmarkItem, path: number[], depth: number = 0) => {
    if (item.type === 'folder') {
      const folder = item as BookmarkFolder;
      const isCollapsed = folder.collapsed || false;
      
      return (
        <div key={item.id} className="group">
          <div 
            className={cn(
              "flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50",
              focusedId === item.id && "bg-muted"
            )}
            style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
          >
            <button
              onClick={() => toggleCollapse(path)}
              className="text-sm flex items-center justify-center w-4 h-4"
            >
              {isCollapsed ? '˃' : '˅'}
            </button>
            <span className="text-lg cursor-pointer" onClick={() => setFocusedId(item.id)}>
              {isCollapsed ? '📁' : '📂'}
            </span>
            <Input
              value={folder.name}
              onChange={(e) => updateItemName(path, e.target.value)}
              onFocus={() => setFocusedId(item.id)}
              className="flex-1 h-7 bg-transparent border-none focus:bg-background"
            />
            {!isCollapsed && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ❌
            </Button>
          </div>
          {!isCollapsed && folder.children.map((child, idx) => 
            renderItem(child, [...path, idx], depth + 1)
          )}
        </div>
      );
    } else {
      const link = item as BookmarkLink;
      
      return (
        <div
          key={item.id}
          className={cn(
            "group flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-muted/50",
            focusedId === item.id && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          <span className="text-lg ml-4 cursor-pointer" onClick={() => setFocusedId(item.id)}>
            🔖
          </span>
          <Input
            value={link.name}
            onChange={(e) => updateItemName(path, e.target.value)}
            onFocus={() => setFocusedId(item.id)}
            placeholder="Name"
            className="flex-1 h-7 bg-transparent border-none focus:bg-background rounded-full"
          />
          <Input
            value={link.url}
            onChange={(e) => updateLinkUrl(path, e.target.value)}
            onFocus={() => setFocusedId(item.id)}
            placeholder="URL"
            className="flex-1 h-7 bg-transparent border-none focus:bg-background rounded-full"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteItem(path)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ❌
          </Button>
        </div>
      );
    }
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
        {currentList.children.map((child, idx) => renderItem(child, [idx]))}
      </div>
    </div>
  );
};
