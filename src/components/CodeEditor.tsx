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

  return (
    <div className="h-full flex flex-col bg-code">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
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
      
      <textarea
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        className={`flex-1 w-full p-4 font-mono text-sm bg-code text-foreground resize-none focus:outline-none ${
          !isValidCode ? 'border-2 border-destructive' : ''
        }`}
        spellCheck={false}
      />
      
      {!isValidCode && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          Invalid {exportFormat.toUpperCase()} format
        </div>
      )}
    </div>
  );
};
