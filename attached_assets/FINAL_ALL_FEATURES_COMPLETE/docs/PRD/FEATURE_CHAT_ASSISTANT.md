# FEATURE: AI Chat Assistant Panel

## Problem
Users need real-time intelligent guidance to navigate credit-related questions, forms, or errors.

## Goals
- Provide 24/7 intelligent simulation of credit help
- Integrate with OpenAI ChatCompletion API
- Operate inside app UI without redirect

## Acceptance Criteria
- Chat UI loads inside /dashboard
- Users can send messages and receive AI replies
- Admins can monitor flagged sessions (optional future)

## UX Notes
- Bottom-right floating button triggers assistant panel
- Avatar icon, fake typing indicator, fade-in effects
- Mobile-safe layout

## Data Model
- None stored; messages ephemeral (unless extended)

## API Endpoints
- POST /api/ai/message
  - Input: { message: string }
  - Output: { response: string }

## Errors
- 429 on too many requests
- 500 if OpenAI API fails

## Analytics Events
- `ai_message_sent`
- `ai_response_received`
