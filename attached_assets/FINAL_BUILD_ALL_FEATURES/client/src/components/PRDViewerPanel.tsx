import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PRDSection {
  id: string;
  title: string;
  content: string;
}

const prdSections: Record<string, PRDSection[]> = {
  upload: [
    {
      id: "upload-overview",
      title: "Document Upload Flow",
      content: `
# Document Upload Feature

## Overview
Allow users to upload credit reports in multiple formats (PDF, DOCX, PNG/JPG) for AI analysis.

## Requirements
- Support PDF, DOCX, and image file formats
- Show upload progress with percentage
- Validate file format and size (max 10MB)
- Display file preview or thumbnail
- Store uploaded files securely
- Trigger OCR processing for image files

## User Flow
1. User clicks "Upload Credit Report" button
2. File picker opens or user drags file into drop zone
3. File validation occurs (format, size)
4. Progress bar shows upload status
5. On success, file appears in document history
6. AI analysis automatically triggers
      `.trim(),
    },
  ],
  ai: [
    {
      id: "ai-overview",
      title: "AI Analysis & Summary",
      content: `
# AI Analysis Feature

## Overview
Use GPT-5 (or Ollama fallback) to analyze credit reports and detect FCRA/Metro2 violations.

## Requirements
- Parse credit report text using OCR (Tesseract.js)
- Send parsed text to AI for analysis
- Detect specific violation types
- Generate structured violation reports
- Classify violations by severity (HIGH/MEDIUM/LOW)
- Include case law citations

## AI Prompt Structure
The AI receives structured prompts requesting:
- Account analysis for compliance
- Date verification (FCRA 605 violations)
- Reporting accuracy checks
- Metro2 format compliance
- Recommended dispute strategies

## Response Format
JSON structure with:
- Violation ID
- Violation type (FCRA statute)
- Severity level
- Description
- Recommended action
      `.trim(),
    },
  ],
  click2mail: [
    {
      id: "click2mail-overview",
      title: "Click2Mail Integration",
      content: `
# Click2Mail Integration

## Overview
Automate physical mailing of dispute letters through Click2Mail API.

## Requirements
- Toggle to enable/disable Click2Mail for each letter
- Validate required fields (recipient address, sender info)
- Generate PDF from dispute letter content
- Submit to Click2Mail API
- Track mailing status
- Store tracking numbers
- Handle delivery confirmations via webhook

## Integration Flow
1. User reviews dispute letter
2. Clicks "Send via Click2Mail"
3. System validates letter and addresses
4. PDF is generated
5. API call to Click2Mail with document
6. Tracking number is returned and stored
7. User receives confirmation

## Configuration
- API credentials stored in environment variables
- Mailing options: First class mail, certified mail
- Full color printing support
- Automatic address validation
      `.trim(),
    },
  ],
  automation: [
    {
      id: "automation-overview",
      title: "Automation & Workflows",
      content: `
# Automation Features

## Overview
Automated workflows for dispute management and follow-ups.

## Features

### 1. 34-Day Follow-Up Sweep
- Hourly cron job checks for disputes sent 34 days ago
- Sends automated reminders to clients
- Prompts for bureau response upload
- Tracks response deadlines

### 2. Multi-Round Disputes
- Automatically track dispute rounds (Round 1, 2, 3+)
- Escalate disputes after bureau responses
- Maintain history of all correspondence
- Generate follow-up letters with previous context

### 3. Credit Freeze Automation
- Puppeteer-based browser automation
- Support for major bureaus (LexisNexis, Innovis, etc.)
- Handle CAPTCHA challenges gracefully
- Automated opt-out submissions
      `.trim(),
    },
  ],
};

export function PRDViewerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="secondary"
          size="default"
          className="shadow-lg"
          data-testid="toggle-prd-viewer"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          View PRDs
        </Button>
      </div>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-20 left-4 w-[450px] h-[500px] bg-background border rounded-xl shadow-2xl z-50 transition-all duration-300 flex flex-col",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        data-testid="prd-viewer-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Product Requirements
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            data-testid="close-prd-viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">AI Analysis</TabsTrigger>
            <TabsTrigger value="click2mail" className="text-xs">Click2Mail</TabsTrigger>
            <TabsTrigger value="automation" className="text-xs">Automation</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            {Object.entries(prdSections).map(([key, sections]) => (
              <TabsContent key={key} value={key} className="mt-4">
                {sections.map((section) => (
                  <div key={section.id} className="prose dark:prose-invert prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {section.content}
                    </div>
                  </div>
                ))}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </div>
    </>
  );
}
