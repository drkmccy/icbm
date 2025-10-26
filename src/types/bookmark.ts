export interface BookmarkLink {
  id: string;
  type: 'link';
  name: string;
  url: string;
}

export interface BookmarkFolder {
  id: string;
  type: 'folder';
  name: string;
  children: BookmarkItem[];
  collapsed?: boolean;
}

export type BookmarkItem = BookmarkLink | BookmarkFolder;

export interface BookmarkList {
  id: string;
  topLevelName: string;
  children: BookmarkItem[];
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'json' | 'html' | 'plist';
