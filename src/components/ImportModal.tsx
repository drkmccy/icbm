import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { ExportFormat, BookmarkList } from '@/types/bookmark';
import { parseJSON, parseHTML, parsePlist, parseCSV } from '@/utils/formatConverters';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ImportModal = ({ open, onClose }: ImportModalProps) => {
  const { setLists, setCurrentList, lists, setExportFormat, addToHistory } = useBookmarks();
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const content = await file.text();
    
    try {
      let parsed;
      let format: ExportFormat = 'json';
      
      switch (extension) {
        case 'json':
          parsed = parseJSON(content);
          format = 'json';
          break;
        case 'html':
        case 'htm':
          parsed = parseHTML(content);
          format = 'html';
          break;
        case 'plist':
          parsed = parsePlist(content);
          format = 'plist';
          break;
        case 'csv':
          parsed = parseCSV(content);
          format = 'json'; // CSV imports default to JSON format
          break;
        default:
          toast.error('Unsupported file format');
          return;
      }
      
      const newList: BookmarkList = {
        id: uuidv4(),
        topLevelName: parsed.topLevelName,
        children: parsed.children,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      setLists([...lists, newList]);
      setCurrentList(newList);
      setExportFormat(format);
      addToHistory(newList.children);
      toast.success('File imported successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to parse file');
      console.error(error);
    }
  }, [lists, setLists, setCurrentList, setExportFormat, onClose, addToHistory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Bookmarks</DialogTitle>
        </DialogHeader>
        
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? 'border-accent bg-accent/10' : 'border-border'
          }`}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            Drag and drop a file here, or
          </p>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                Choose File
                <input
                  type="file"
                  accept=".json,.html,.htm,.plist,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </span>
            </Button>
          </label>
          <p className="mt-4 text-xs text-muted-foreground">
            Supported formats: JSON, HTML, Plist, CSV
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
