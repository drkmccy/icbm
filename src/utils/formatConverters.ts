import { BookmarkItem, BookmarkFolder, BookmarkLink, ExportFormat } from '@/types/bookmark';

export const convertToJSON = (topLevelName: string, children: BookmarkItem[]): string => {
  const output: any[] = [{ toplevel_name: topLevelName }];
  
  const processItem = (item: BookmarkItem): any => {
    if (item.type === 'link') {
      return {
        name: item.name,
        url: item.url,
      };
    } else {
      const folder = item as BookmarkFolder;
      return {
        name: folder.name,
        children: folder.children.map(processItem),
      };
    }
  };
  
  children.forEach(child => output.push(processItem(child)));
  
  return JSON.stringify(output, null, 2);
};

export const convertToHTML = (topLevelName: string, children: BookmarkItem[]): string => {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <!--This is an automatically generated file.
    It will be read and overwritten.
    Do Not Edit! -->
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=utf-8">
    <Title>Bookmarks</Title>
    <H1>Bookmarks</H1>
<DL><p>
<DT><H3>${topLevelName}</H3>
    <DL><p>
`;

  const processItem = (item: BookmarkItem, indent: string): string => {
    if (item.type === 'link') {
      return `${indent}<DT><A HREF="${item.url}">${item.name}</A>\n`;
    } else {
      const folder = item as BookmarkFolder;
      let result = `${indent}<DT><H3>${folder.name}</H3>\n${indent}    <DL><p>\n`;
      folder.children.forEach(child => {
        result += processItem(child, indent + '    ');
      });
      result += `${indent}    </DL><p>\n`;
      return result;
    }
  };

  children.forEach(child => {
    html += processItem(child, '    ');
  });

  html += `    </DL><p>
</DL><p>`;

  return html;
};

export const convertToPlist = (topLevelName: string, children: BookmarkItem[]): string => {
  let plist = `<key>ManagedBookmarks</key>
<array>
<dict>
<key>toplevel_name</key>
<string>${topLevelName}</string></dict>
`;

  const processItem = (item: BookmarkItem): string => {
    if (item.type === 'link') {
      return `<dict>
<key>name</key>
<string>${item.name}</string>
<key>url</key>
<string>${item.url}</string></dict>
`;
    } else {
      const folder = item as BookmarkFolder;
      let result = `<dict>
<key>children</key>
<array>
`;
      folder.children.forEach(child => {
        result += processItem(child);
      });
      result += `</array>
<key>name</key>
<string>${folder.name}</string></dict>
`;
      return result;
    }
  };

  children.forEach(child => {
    plist += processItem(child);
  });

  plist += '</array>';

  return plist;
};

export const parseJSON = (content: string): { topLevelName: string; children: BookmarkItem[] } => {
  const data = JSON.parse(content);
  const topLevelName = data[0]?.toplevel_name || 'Imported Bookmarks';
  
  const processItem = (item: any): BookmarkItem => {
    if (item.url) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: 'link',
        name: item.name,
        url: item.url,
      };
    } else {
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: 'folder',
        name: item.name,
        children: item.children?.map(processItem) || [],
      };
    }
  };
  
  const children = data.slice(1).map(processItem);
  
  return { topLevelName, children };
};

export const parseHTML = (content: string): { topLevelName: string; children: BookmarkItem[] } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  
  let topLevelName = 'Imported Bookmarks';
  const topH3 = doc.querySelector('DL > DT > H3');
  if (topH3) {
    topLevelName = topH3.textContent || topLevelName;
  }
  
  const children: BookmarkItem[] = [];
  
  const processDL = (dl: Element): BookmarkItem[] => {
    const items: BookmarkItem[] = [];
    const dts = Array.from(dl.children).filter(el => el.tagName === 'DT');
    
    dts.forEach(dt => {
      const h3 = dt.querySelector('H3');
      const a = dt.querySelector('A');
      
      if (h3) {
        const nextDL = dt.nextElementSibling;
        const folder: BookmarkFolder = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'folder',
          name: h3.textContent || 'Folder',
          children: nextDL && nextDL.tagName === 'DL' ? processDL(nextDL) : [],
        };
        items.push(folder);
      } else if (a) {
        const link: BookmarkLink = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'link',
          name: a.textContent || 'Link',
          url: a.getAttribute('HREF') || '',
        };
        items.push(link);
      }
    });
    
    return items;
  };
  
  const mainDL = doc.querySelector('DL > DT > DL');
  if (mainDL) {
    children.push(...processDL(mainDL));
  }
  
  return { topLevelName, children };
};

export const parsePlist = (content: string): { topLevelName: string; children: BookmarkItem[] } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  
  let topLevelName = 'Imported Bookmarks';
  const dicts = Array.from(doc.querySelectorAll('array > dict'));
  
  if (dicts.length > 0) {
    const firstDict = dicts[0];
    const keys = Array.from(firstDict.querySelectorAll('key'));
    const strings = Array.from(firstDict.querySelectorAll('string'));
    
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].textContent === 'toplevel_name' && strings[i]) {
        topLevelName = strings[i].textContent || topLevelName;
        break;
      }
    }
  }
  
  const processDict = (dict: Element): BookmarkItem | null => {
    const keys = Array.from(dict.querySelectorAll(':scope > key'));
    const values = Array.from(dict.children).filter(el => el.tagName !== 'key');
    
    let name = '';
    let url = '';
    let children: BookmarkItem[] = [];
    let hasChildren = false;
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i].textContent;
      const value = values[i];
      
      if (key === 'name') {
        name = value?.textContent || '';
      } else if (key === 'url') {
        url = value?.textContent || '';
      } else if (key === 'children' && value?.tagName === 'array') {
        hasChildren = true;
        const childDicts = Array.from(value.querySelectorAll(':scope > dict'));
        children = childDicts.map(processDict).filter(Boolean) as BookmarkItem[];
      } else if (key === 'toplevel_name') {
        return null;
      }
    }
    
    if (url) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: 'link',
        name,
        url,
      };
    } else if (hasChildren) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: 'folder',
        name,
        children,
      };
    }
    
    return null;
  };
  
  const children = dicts.slice(1).map(processDict).filter(Boolean) as BookmarkItem[];
  
  return { topLevelName, children };
};

export const parseCSV = (content: string): { topLevelName: string; children: BookmarkItem[] } => {
  const lines = content.trim().split('\n');
  const children: BookmarkItem[] = [];
  
  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length >= 2) {
      children.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'link',
        name: parts[0],
        url: parts[1],
      });
    }
  }
  
  return { topLevelName: 'Imported from CSV', children };
};
