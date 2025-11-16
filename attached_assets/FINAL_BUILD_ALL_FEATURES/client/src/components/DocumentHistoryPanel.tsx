import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  filename: string;
  uploadedAt: Date;
  status: "uploaded" | "processing" | "complete" | "error";
  type: "credit-report" | "dispute-letter" | "response";
  size?: number;
}

interface DocumentHistoryPanelProps {
  documents?: Document[];
  onViewDocument?: (doc: Document) => void;
  onDownloadDocument?: (doc: Document) => void;
}

export function DocumentHistoryPanel({
  documents = [],
  onViewDocument,
  onDownloadDocument,
}: DocumentHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status: Document["status"]) => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed top-20 right-4 z-40">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="default"
          size="default"
          className="shadow-lg"
          data-testid="toggle-document-history"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          History ({documents.length})
        </Button>
      </div>

      {/* Sliding Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-96 bg-background border-l shadow-2xl z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        data-testid="document-history-panel"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-lg">Document History</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              data-testid="close-document-history"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Document List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a credit report to get started
                  </p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-3 hover:bg-accent transition-colors"
                    data-testid={`document-item-${doc.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.uploadedAt.toLocaleDateString()} at{" "}
                          {doc.uploadedAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", getStatusColor(doc.status))}
                          >
                            {doc.status}
                          </Badge>
                          {doc.size && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(doc.size)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onViewDocument?.(doc)}
                        data-testid={`view-document-${doc.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onDownloadDocument?.(doc)}
                        data-testid={`download-document-${doc.id}`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          data-testid="document-history-backdrop"
        />
      )}
    </>
  );
}
