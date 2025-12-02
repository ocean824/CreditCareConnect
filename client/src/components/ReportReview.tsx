import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Scale,
  Clock
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface ReviewViolation {
  id: string;
  ruleId: string;
  code: string;
  description: string;
  fcraSection: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  accountLabel: string;
  bureau?: string;
  details?: Record<string, unknown>;
}

export interface ReviewEntry {
  id: string;
  accountNumber: string;
  creditorName: string;
  accountType: string;
  balance?: number;
  status?: string;
  bureau: string;
  violations: ReviewViolation[];
  flagged: boolean;
}

export interface ReportReviewProps {
  entries: ReviewEntry[];
  onToggleFlag: (entryId: string, flagged: boolean) => void;
  onToggleViolation?: (entryId: string, violationId: string, included: boolean) => void;
  onGenerateLetters?: (selectedEntries: ReviewEntry[]) => void;
  isLoading?: boolean;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-blue-500 text-white',
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  CRITICAL: XCircle,
  HIGH: AlertTriangle,
  MEDIUM: Clock,
  LOW: CheckCircle2,
};

function ViolationItem({ violation }: { violation: ReviewViolation }) {
  const [isOpen, setIsOpen] = useState(false);
  const SeverityIcon = severityIcons[violation.severity] || AlertTriangle;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div 
          className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
          data-testid={`violation-item-${violation.id}`}
        >
          <SeverityIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
            violation.severity === 'CRITICAL' ? 'text-red-500' :
            violation.severity === 'HIGH' ? 'text-orange-500' :
            violation.severity === 'MEDIUM' ? 'text-yellow-500' : 'text-blue-500'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="secondary" 
                className={severityColors[violation.severity]}
              >
                {violation.severity}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {violation.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {violation.ruleId}
              </span>
            </div>
            <p className="text-sm mt-1">{violation.description}</p>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-11 pr-3 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Legal Basis:</span>
            <span className="text-muted-foreground">{violation.fcraSection}</span>
          </div>
          {violation.details && Object.keys(violation.details).length > 0 && (
            <div className="text-xs bg-muted rounded p-2 space-y-1">
              {Object.entries(violation.details).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntryCard({ 
  entry, 
  onToggleFlag,
}: { 
  entry: ReviewEntry; 
  onToggleFlag: (flagged: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(entry.violations.length <= 3);
  
  const criticalCount = entry.violations.filter(v => v.severity === 'CRITICAL').length;
  const highCount = entry.violations.filter(v => v.severity === 'HIGH').length;

  return (
    <Card 
      className={`transition-all ${entry.flagged ? 'ring-2 ring-primary' : ''}`}
      data-testid={`review-entry-${entry.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={entry.flagged}
              onCheckedChange={(checked) => onToggleFlag(checked === true)}
              className="mt-1"
              data-testid={`checkbox-entry-${entry.id}`}
            />
            <div>
              <CardTitle className="text-base">{entry.creditorName}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>Account: ****{entry.accountNumber.slice(-4)}</span>
                <span className="text-muted-foreground">|</span>
                <span>{entry.accountType}</span>
                <span className="text-muted-foreground">|</span>
                <Badge variant="outline" className="text-xs">{entry.bureau}</Badge>
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {entry.balance !== undefined && (
              <span className="text-sm font-medium">
                ${entry.balance.toLocaleString()}
              </span>
            )}
            {entry.status && (
              <Badge 
                variant={entry.status === 'Open' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {entry.status}
              </Badge>
            )}
          </div>
        </div>
        
        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex gap-2 mt-2 pl-7">
            {criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {highCount} High Priority
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between pl-7 mb-2">
            <span className="text-sm font-medium">
              {entry.violations.length} violation{entry.violations.length !== 1 ? 's' : ''} detected
            </span>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                data-testid={`toggle-violations-${entry.id}`}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
            <div className="space-y-2 pl-7">
              {entry.violations.map((violation) => (
                <ViolationItem key={violation.id} violation={violation} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function ReportReview({
  entries,
  onToggleFlag,
  onGenerateLetters,
  isLoading = false,
}: ReportReviewProps) {
  const selectedEntries = entries.filter(e => e.flagged);
  const totalViolations = entries.reduce((sum, e) => sum + e.violations.length, 0);
  const selectedViolations = selectedEntries.reduce((sum, e) => sum + e.violations.length, 0);
  
  const handleSelectAll = useCallback(() => {
    const allSelected = entries.every(e => e.flagged);
    entries.forEach(e => onToggleFlag(e.id, !allSelected));
  }, [entries, onToggleFlag]);
  
  const handleGenerateLetters = useCallback(() => {
    if (onGenerateLetters && selectedEntries.length > 0) {
      onGenerateLetters(selectedEntries);
    }
  }, [onGenerateLetters, selectedEntries]);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Violations Found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Your credit report analysis did not detect any violations. 
            This could mean your report is accurate, or manual review may be needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="report-review">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{entries.length}</div>
                <div className="text-xs text-muted-foreground">Accounts</div>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <div className="text-2xl font-bold">{totalViolations}</div>
                <div className="text-xs text-muted-foreground">Violations</div>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{selectedEntries.length}</div>
                <div className="text-xs text-muted-foreground">Selected</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="btn-select-all"
              >
                {entries.every(e => e.flagged) ? 'Deselect All' : 'Select All'}
              </Button>
              
              {onGenerateLetters && (
                <Button
                  onClick={handleGenerateLetters}
                  disabled={selectedEntries.length === 0 || isLoading}
                  data-testid="btn-generate-letters"
                >
                  {isLoading ? 'Generating...' : `Generate Letters (${selectedViolations})`}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <ScrollArea className="h-[600px]">
        <div className="space-y-3 pr-4">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onToggleFlag={(flagged) => onToggleFlag(entry.id, flagged)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
