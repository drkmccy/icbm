import React, { useEffect, useState, useRef } from 'react';
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
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setScrollPos({ left: el.scrollLeft, top: el.scrollTop });
  };

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
      // Proper token-based JSON highlighting (handles escapes, colons inside
      // strings, punctuation, and distinguishes keys from string values).
      const tokenRe = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
      let out = '';
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = tokenRe.exec(code)) !== null) {
        out += escapeHtml(code.slice(lastIndex, match.index));
        lastIndex = match.index + match[0].length;

        const [, str, colon, num, keyword, punct] = match;
        if (str !== undefined) {
          const cls = colon ? 'syntax-purple' : 'syntax-green';
          out += `<span class="${cls}">${escapeHtml(str)}</span>`;
          if (colon) out += escapeHtml(colon.slice(0, -1)) + '<span class="syntax-pink">:</span>';
        } else if (num !== undefined) {
          out += `<span class="syntax-orange">${escapeHtml(num)}</span>`;
        } else if (keyword !== undefined) {
          out += `<span class="syntax-purple">${escapeHtml(keyword)}</span>`;
        } else if (punct !== undefined) {
          const cls = punct === '[' || punct === ']' ? 'syntax-yellow' : 'syntax-pink';
          out += `<span class="${cls}">${escapeHtml(punct)}</span>`;
        }
      }
      out += escapeHtml(code.slice(lastIndex));
      return out;

    } else if (format === 'html') {
      // Highlight HTML: tags=pink, attributes=cyan, values=green
      highlighted = highlighted
        .replace(/(&lt;\/?)([\w-]+)(\s|&gt;)/g, '$1<span class="syntax-pink">$2</span>$3')
        .replace(/([\w-]+)=(&quot;)/g, '<span class="syntax-cyan">$1</span>=$2')
        .replace(/=(&quot;)((?:[^&]|&(?!quot;))*?)(&quot;)/g, '=<span class="syntax-green">$1$2$3</span>');
    } else if (format === 'plist') {
      // Highlight Plist (XML-based)
      highlighted = highlighted
        .replace(/&lt;(\/?[\w-]+)/g, '&lt;<span class="syntax-pink">$1</span>')
        .replace(/&gt;/g, '<span class="syntax-pink">&gt;</span>')
        .replace(/&lt;(key|string|array|dict)&gt;(.*?)&lt;\/(key|string|array|dict)&gt;/g, 
          (match, tag1, content, tag2) => {
            const coloredTag1 = `&lt;<span class="syntax-pink">${tag1}</span>&gt;`;
            const coloredTag2 = `&lt;/<span class="syntax-pink">${tag2}</span>&gt;`;
            const coloredContent = tag1 === 'key' 
              ? `<span class="syntax-cyan">${content}</span>`
              : `<span class="syntax-green">${content}</span>`;
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
      
      <div className="flex-1 bg-code relative overflow-hidden">
        {/* Highlight layer - synced with textarea scroll, non-interactive */}
        <div className="absolute inset-0 overflow-hidden p-4 pointer-events-none">
          <pre
            className="text-sm font-mono w-max"
            style={{ transform: `translate(${-scrollPos.left}px, ${-scrollPos.top}px)` }}
          >
            <code 
              dangerouslySetInnerHTML={{ __html: highlightCode(code, exportFormat) }}
              className={`block text-code-foreground whitespace-pre ${!isValidCode ? 'border-2 border-destructive' : ''}`}
            />
          </pre>
        </div>
        
        {/* Editing layer - shows scrollbars */}
        <textarea
          ref={textAreaRef}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onScroll={handleEditorScroll}
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent text-transparent resize-none focus:outline-none caret-code-foreground overflow-auto"
          spellCheck={false}
          style={{ caretColor: 'hsl(var(--code-foreground))' }}
          wrap="off"
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
