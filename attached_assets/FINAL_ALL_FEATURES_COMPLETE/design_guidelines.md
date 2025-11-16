# Design Guidelines: Personal Credit Pros / CreditCareConnect

## Design Approach
**System:** Material Design + Stripe-inspired fintech principles
**Rationale:** Financial data platform requiring trust, clarity, and information density. Design emphasizes data hierarchy, professional restraint, and guided workflows.

## Typography
- **Primary Font:** Inter (Google Fonts) - exceptional legibility for data-heavy interfaces
- **Hierarchy:**
  - H1: 2.5rem/600 - Dashboard headers
  - H2: 1.875rem/600 - Section titles
  - H3: 1.5rem/600 - Card headers, modal titles
  - Body Large: 1.125rem/400 - Primary content
  - Body: 1rem/400 - Standard text
  - Small: 0.875rem/400 - Metadata, labels
  - Caption: 0.75rem/500 - Status badges, timestamps

## Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6
- Section spacing: gap-8, space-y-12
- Tight groupings: gap-2, gap-4
- Cards: p-6, rounded-lg
- Modals: p-8

## Core Components

### 1. Onboarding Modal Flow
**Structure:** Full-screen overlay with centered card (max-w-2xl)
- **Progress Indicator:** Top-aligned stepper (1/5, 2/5, etc.) with connecting lines
- **Content Area:** Single-column form with generous vertical spacing (space-y-6)
- **Navigation:** Bottom-fixed bar with "Back" (text-only) and "Continue" (primary button)
- **Typography:** H2 for step titles, Body Large for descriptions, Small for helper text

### 2. Document Upload Flow
**Layout:** Two-column split on desktop (lg:grid-cols-2), stacked mobile
- **Left Column:** Drag-drop zone (min-h-96, border-2 dashed, rounded-lg)
  - Center-aligned icon (document + upload arrow)
  - "Drag files here or click to browse"
  - Supported formats list (caption size)
- **Right Column:** Upload queue/history
  - Each file: Horizontal layout with icon, filename, size, progress bar, status badge
  - Progress bars: Full-width, rounded, animated fill
  - Status badges: "Processing", "Complete", "Error" with icons
- **States:** Empty state, uploading (with percentage), success, error with retry

### 3. Print Preview Modal
**Layout:** Full-screen modal (95vh, 95vw on desktop)
- **Header Bar:** Fixed top with document title (H3), print/download/close buttons
- **Preview Area:** Center panel (max-w-4xl) with white background simulating paper
  - Letter content with proper margins (p-12)
  - Letterhead template styling
  - Footer with page numbers
- **Sidebar (Right):** Fixed width (w-80)
  - "Print Settings" section
  - Page selection dropdown
  - Print button (primary, prominent)
  - "Save as PDF" (secondary)

### 4. Document History Panel
**Structure:** Sidebar panel (w-96) or full-width list view
- **Header:** "Document History" with filter/search input
- **List Items:** Card-based design (divide-y pattern)
  - Each row: Icon (document type), Title (H3 size), Date (Small), Status badge
  - Expandable: Click reveals metadata (recipient, tracking number, responses)
  - Actions: View, Download, Duplicate (icon buttons, right-aligned)
- **Empty State:** Centered illustration with "No documents yet" message

### 5. PRD Viewer Panel
**Layout:** Split-pane design
- **Left Nav (20%):** Sticky sidebar with table of contents
  - Hierarchical list of sections (clickable anchors)
  - Active section highlighted
- **Content Area (80%):** Article-style layout (max-w-prose)
  - H2 for major sections, H3 for subsections
  - Code blocks with syntax highlighting placeholder
  - Tables with zebra striping
  - Inline images with captions
  - Scroll-spy to sync TOC with scroll position

## Navigation Architecture
**Main Dashboard:**
- **Top Bar:** Logo left, navigation center (Reports, Disputes, Documents), user menu right
- **Sidebar:** Collapsed by default (icons only), expands on hover
  - Dashboard, Credit Analysis, Dispute Center, Documents, Settings
  - Active state: filled background, indicator bar

## Data Visualization
- **Credit Score Display:** Large circular progress indicator (200px diameter) with score in center
- **Report Cards:** Grid layout (md:grid-cols-2, lg:grid-cols-3) with icons, values, trend indicators
- **Tables:** Zebra striping, sticky headers, row hover states, sort indicators

## Forms & Inputs
- **Text Inputs:** Full-width, h-12, rounded-md, border with focus ring
- **Labels:** Above inputs (text-sm, font-medium, mb-2)
- **Help Text:** Below inputs (text-xs, muted)
- **Validation:** Inline error messages in red, success checkmarks
- **Multi-step Forms:** Progress tracker at top, fields grouped with space-y-6

## Modals & Overlays
- **Backdrop:** Semi-transparent overlay (backdrop-blur-sm)
- **Container:** Centered, max-w-2xl (adjustable), rounded-xl, shadow-2xl
- **Close Button:** Top-right (icon-only, p-2)
- **Actions:** Bottom-aligned, right-justified button group (gap-3)

## Buttons & CTAs
- **Primary:** Solid background, rounded-md, px-6, py-3, font-medium
- **Secondary:** Outlined, same padding
- **Ghost:** Text only with hover background
- **Icon Buttons:** Square (h-10 w-10), rounded
- **Hero/Image Overlays:** Backdrop-blur-md background for legibility

## Images
**Hero Section:** Large hero image (h-96 to h-[32rem]) showing professional workspace or abstract trust/security visualization
- Placement: Dashboard welcome area or landing page
- Style: Modern, clean, professional photography with subtle overlay
- No generic stock photos - prefer abstract patterns or authentic workspace imagery

## Accessibility
- Consistent focus indicators (ring-2 ring-offset-2)
- ARIA labels for icon-only buttons
- Semantic HTML (proper heading hierarchy)
- Keyboard navigation support (tab order, escape to close)
- Screen reader announcements for status changes
- Minimum touch targets: 44px × 44px

## Animations
Use sparingly:
- **Modal Entry:** Fade + scale-95 to scale-100 (150ms)
- **Progress Bars:** Smooth width transitions (300ms ease-out)
- **Toast Notifications:** Slide from top-right (200ms)
- **NO:** Scroll animations, parallax, continuous motion