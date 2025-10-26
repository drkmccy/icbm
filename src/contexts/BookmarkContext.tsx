import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BookmarkList, BookmarkItem, ExportFormat } from '@/types/bookmark';
import { v4 as uuidv4 } from 'uuid';

interface BookmarkContextType {
  lists: BookmarkList[];
  currentList: BookmarkList | null;
  exportFormat: ExportFormat;
  theme: 'light' | 'dark';
  defaultFormat: ExportFormat;
  selectedItems: string[];
  history: BookmarkItem[][];
  historyIndex: number;
  
  createNewList: () => void;
  selectList: (id: string) => void;
  updateList: (list: BookmarkList) => void;
  deleteList: (id: string) => void;
  importList: (data: any, format: ExportFormat, filename?: string) => void;
  setExportFormat: (format: ExportFormat) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setDefaultFormat: (format: ExportFormat) => void;
  setSelectedItems: (items: string[]) => void;
  addToHistory: (children: BookmarkItem[]) => void;
  undo: () => void;
  redo: () => void;
  setLists: (lists: BookmarkList[]) => void;
  setCurrentList: (list: BookmarkList | null) => void;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lists, setLists] = useState<BookmarkList[]>([]);
  const [currentList, setCurrentList] = useState<BookmarkList | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [defaultFormat, setDefaultFormat] = useState<ExportFormat>('json');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [history, setHistory] = useState<BookmarkItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load from localStorage on mount
  useEffect(() => {
    const savedLists = localStorage.getItem('filink_lists');
    const savedCurrentId = localStorage.getItem('filink_current_list');
    const savedTheme = localStorage.getItem('filink_theme') as 'light' | 'dark' | null;
    const savedDefaultFormat = localStorage.getItem('filink_default_format') as ExportFormat | null;

    if (savedLists) {
      const parsedLists = JSON.parse(savedLists);
      setLists(parsedLists);
      
      if (savedCurrentId) {
        const current = parsedLists.find((l: BookmarkList) => l.id === savedCurrentId);
        if (current) {
          setCurrentList(current);
          setExportFormat(savedDefaultFormat || 'json');
        }
      }
    }

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }

    if (savedDefaultFormat) {
      setDefaultFormat(savedDefaultFormat);
    }
  }, []);

  // Save to localStorage whenever lists change
  useEffect(() => {
    if (lists.length > 0) {
      localStorage.setItem('filink_lists', JSON.stringify(lists));
    }
  }, [lists]);

  // Save current list ID
  useEffect(() => {
    if (currentList) {
      localStorage.setItem('filink_current_list', currentList.id);
      localStorage.setItem('filink_format_' + currentList.id, exportFormat);
    }
  }, [currentList, exportFormat]);

  // Save theme
  useEffect(() => {
    localStorage.setItem('filink_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Save default format
  useEffect(() => {
    localStorage.setItem('filink_default_format', defaultFormat);
  }, [defaultFormat]);

  const createNewList = useCallback(() => {
    const newList: BookmarkList = {
      id: uuidv4(),
      topLevelName: 'New Bookmark List',
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setLists(prev => [...prev, newList]);
    setCurrentList(newList);
    setExportFormat(defaultFormat);
    setHistory([newList.children]);
    setHistoryIndex(0);
  }, [defaultFormat]);

  const selectList = useCallback((id: string) => {
    const list = lists.find(l => l.id === id);
    if (list) {
      setCurrentList(list);
      const savedFormat = localStorage.getItem('filink_format_' + id) as ExportFormat;
      setExportFormat(savedFormat || defaultFormat);
      setHistory([list.children]);
      setHistoryIndex(0);
      setSelectedItems([]);
    }
  }, [lists, defaultFormat]);

  const updateList = useCallback((updatedList: BookmarkList) => {
    updatedList.updatedAt = Date.now();
    setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l));
    setCurrentList(updatedList);
  }, []);

  const deleteList = useCallback((id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (currentList?.id === id) {
      setCurrentList(null);
    }
  }, [currentList]);

  const importList = useCallback((data: any, format: ExportFormat, filename?: string) => {
    // Implementation for importing different formats
    const newList: BookmarkList = {
      id: uuidv4(),
      topLevelName: filename?.replace(/\.[^/.]+$/, '') || 'Imported List',
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setLists(prev => [...prev, newList]);
    setCurrentList(newList);
    setExportFormat(format);
  }, []);

  const addToHistory = useCallback((children: BookmarkItem[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, JSON.parse(JSON.stringify(children))];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0 && currentList) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      updateList({ ...currentList, children: history[newIndex] });
    }
  }, [historyIndex, currentList, history, updateList]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1 && currentList) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateList({ ...currentList, children: history[newIndex] });
    }
  }, [historyIndex, history, currentList, updateList]);

  return (
    <BookmarkContext.Provider
      value={{
        lists,
        currentList,
        exportFormat,
        theme,
        defaultFormat,
        selectedItems,
        history,
        historyIndex,
        createNewList,
        selectList,
        updateList,
        deleteList,
        importList,
        setExportFormat,
        setTheme,
        setDefaultFormat,
        setSelectedItems,
        addToHistory,
        undo,
        redo,
        setLists,
        setCurrentList,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmarks = () => {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within BookmarkProvider');
  }
  return context;
};
