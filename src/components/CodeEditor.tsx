import { useEffect, useState } from 'react';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { ExportFormat } from '@/types/bookmark';
import { Button } from './ui/button';
import { Download, Copy } from 'lucide-react';
import { convertToJSON, convertToHTML, convertToPlist, parseJSON, parseHTML, parsePlist } from '@/utils/formatConverters';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CodeEditor = () => {
  const { currentList, updateList, exportFormat, setExportFormat, addToHistory } = useBookmarks();
  const [code, setCode] = useState('');
  const [isValidCode, setIsValidCode] = useState(true);

  useEffect(() => {
    if (currentList) {
      try {
        let converted = '';
        switch (exportFormat) {
          case 'json':
            converted = convertToJSON(currentList.topLevelName, currentList.children);
            break;
          case 'html':
            converted = convertToHTML(currentList.topLevelName, currentList.children);
            break;
          case 'plist':
            converted = convertToPlist(currentList.topLevelName, currentList.children);
            break;
        }
        setCode(converted);
        setIsValidCode(true);
      } catch (error) {
        setIsValidCode(false);
      }
    }
  }, [currentList, exportFormat]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    
    try {
      let parsed;
      switch (exportFormat) {
        case 'json':
          parsed = parseJSON(newCode);
          break;
        case 'html':
          parsed = parseHTML(newCode);
          break;
        case 'plist':
          parsed = parsePlist(newCode);
          break;
        default:
          return;
      }
      
      if (currentList) {
        const updated = {
          ...currentList,
          topLevelName: parsed.topLevelName,
          children: parsed.children,
        };
        addToHistory(updated.children);
        updateList(updated);
      }
      setIsValidCode(true);
    } catch (error) {
      setIsValidCode(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    if (!currentList) return;
    
    const extensions: Record<ExportFormat, string> = {
      json: 'json',
      html: 'html',
      plist: 'plist',
    };
    
    const filename = `${currentList.topLevelName.replace(/\s+/g, '_')}.${extensions[exportFormat]}`;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  if (!currentList) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-code">
        <p>No list selected</p>
      </div>
    );
  }

  const highlightCode = (code: string, format: ExportFormat): string => {
    const escapeHtml = (str: string) => 
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
    
    let highlighted = escapeHtml(code);
    
    if (format === 'json') {
      // Highlight JSON
      highlighted = highlighted
        .replace(/(".*?")\s*:/g, '<span style="color: hsl(var(--code-cyan))">$1</span>:')
        .replace(/:\s*(".*?")/g, ': <span style="color: hsl(var(--code-green))">$1</span>')
        .replace(/:\s*(\d+)/g, ': <span style="color: hsl(var(--code-purple))">$1</span>')
        .replace(/:\s*(true|false|null)/g, ': <span style="color: hsl(var(--code-purple))">$1</span>');
    } else if (format === 'html') {
      // Highlight HTML
      highlighted = highlighted
        .replace(/&lt;(\/?[\w-]+)/g, '&lt;<span style="color: hsl(var(--code-pink))">$1</span>')
        .replace(/([\w-]+)=/g, '<span style="color: hsl(var(--code-green))">$1</span>=')
        .replace(/=(&quot;.*?&quot;)/g, '=<span style="color: hsl(var(--code-yellow))">$1</span>')
        .replace(/&gt;/g, '<span style="color: hsl(var(--code-pink))">&gt;</span>');
    } else if (format === 'plist') {
      // Highlight Plist (XML-based)
      highlighted = highlighted
        .replace(/&lt;(\/?[\w-]+)/g, '&lt;<span style="color: hsl(var(--code-pink))">$1</span>')
        .replace(/&gt;/g, '<span style="color: hsl(var(--code-pink))">&gt;</span>')
        .replace(/&lt;(key|string|array|dict)&gt;(.*?)&lt;\/(key|string|array|dict)&gt;/g, 
          (match, tag1, content, tag2) => {
            const coloredTag1 = `&lt;<span style="color: hsl(var(--code-pink))">${tag1}</span>&gt;`;
            const coloredTag2 = `&lt;/<span style="color: hsl(var(--code-pink))">${tag2}</span>&gt;`;
            const coloredContent = tag1 === 'key' 
              ? `<span style="color: hsl(var(--code-cyan))">${content}</span>`
              : `<span style="color: hsl(var(--code-green))">${content}</span>`;
            return `${coloredTag1}${coloredContent}${coloredTag2}`;
          });
    }
    
    return highlighted;
  };

  return (
    <div className="h-full flex flex-col bg-code">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card z-10 relative">
        <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="plist">Plist</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-code relative">
        <pre className="p-4 text-sm font-mono">
          <code 
            dangerouslySetInnerHTML={{ __html: highlightCode(code, exportFormat) }}
            className={`block text-code-foreground ${!isValidCode ? 'border-2 border-destructive' : ''}`}
          />
        </pre>
        
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent text-code-foreground resize-none focus:outline-none caret-code-foreground opacity-0 focus:opacity-100"
          spellCheck={false}
          style={{ caretColor: 'hsl(var(--code-foreground))' }}
        />
      </div>
      
      {!isValidCode && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          Invalid {exportFormat.toUpperCase()} format
        </div>
      )}
    </div>
  );
};
