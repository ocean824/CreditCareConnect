# FEATURE: Dispute Letter Generator

## Problem
Users need to generate legally compliant dispute letters to correct inaccuracies on their credit reports.

## Goals
- Help users draft dispute letters aligned with FCRA, FDCPA, or Metro 2.
- Offer an interactive UI to guide letter creation.
- Export letters in PDF format, ready for email/postal submission.

## Acceptance Criteria
- Form includes: Bureau, Creditor, Error Type, Legal Reference
- Letter auto-populates based on form data
- PDF download available post-generation
- If logged in, save user letters

## UX Notes
- Accessible at /disputes
- Form + preview UI
- Legal basis dropdown with contextual help

## API Endpoints
- POST /api/disputes/generate → returns PDF
- GET /api/disputes/user → user history

## Data Model
- DisputeLetter {
    id,
    userId,
    bureau,
    creditor,
    errorType,
    legalBasis,
    pdfPath,
    createdAt
  }

## Errors
- 400: Missing fields
- 500: PDF generation failed

## Analytics Events
- `dispute_created`
- `pdf_downloaded`
