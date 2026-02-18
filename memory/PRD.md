# Texas Wholesaling Command Center - PRD

## Project Overview
Mobile command center for Texas real estate wholesaling operation with 11 AI voice agents making 320+ outbound calls/day across 14 Houston-area counties.

## Original Problem Statement
Fix backend services that were incorrectly referencing "Quiet Hours Valet" (apartment trash service) instead of Texas Wholesaling (real estate cold calling).

## What Was Fixed (Feb 18, 2026)

### Files Completely Rewritten:
1. **services/api/makeWebhooks.ts** - Now handles TW-specific webhooks:
   - New Lead Pipeline (from skip tracing)
   - Call Completed Logger
   - Hot Lead Alert (motivation 7+)
   - Deal Package Sender (Blaze)
   - Offer Relay
   - Contract Signed
   - Daily Report
   - DNC Management

2. **services/agents/vapiService.ts** - Now supports 11 TW agents:
   - Zara TW (Receptionist) - inbound motivated sellers
   - 8 Cold Callers (Ace, Maya, Eli, Nova, Raven, Jett, Sage, Finn)
   - Luna (Follow-Up Agent) - Day 1,3,7,14,30,60 cadence
   - Blaze (Disposition Agent) - sells to cash buyers

3. **services/api/supabaseService.ts** - NEW FILE for TW database:
   - leads table operations
   - deals table operations
   - buyers (cash buyer list)
   - call_logs
   - comps (comparable sales)
   - Dashboard stats

4. **hooks/useAgents.ts** - Agent management hooks for TW

5. **store/useAppStore.ts** - Global state for TW data model

6. **app/_layout.tsx** - Root layout with TW initialization

7. **services/notifications/notificationService.ts** - TW-specific alerts

8. **package.json** - Updated name and description

### Deleted Files:
- services/api/googleSheetsService.ts (replaced by supabaseService.ts)

## Architecture

### Two-Number Twilio Setup:
- **INBOUND (346)**: Zara answers. On website, bandit signs, direct mail.
- **OUTBOUND (281)**: 8 cold callers + Luna + Blaze. Never on marketing.

### 11 AI Agents:
| Agent | Role | Number | Counties |
|-------|------|--------|----------|
| Zara TW | Receptionist | INBOUND | All |
| Ace | Cold Caller | OUTBOUND | Harris N/E |
| Maya | Cold Caller | OUTBOUND | Harris S/W |
| Eli | Cold Caller | OUTBOUND | Fort Bend, Brazoria |
| Nova | Cold Caller | OUTBOUND | Montgomery, Walker |
| Raven | Cold Caller | OUTBOUND | Galveston, Chambers |
| Jett | Cold Caller | OUTBOUND | Liberty, San Jacinto |
| Sage | Cold Caller | OUTBOUND | Waller, Austin Co. |
| Finn | Cold Caller | OUTBOUND | Colorado, Wharton, Matagorda |
| Luna | Follow-Up | OUTBOUND | All (warm leads) |
| Blaze | Disposition | OUTBOUND | All (cash buyers) |

### Data Flow:
```
County Scrapers → Skip Tracing → leads table → Cold Callers
      ↓                              ↓
Hot Leads (7+) → Domonique → deals table → Blaze → buyers → Close
```

## Remaining Setup Required

### 1. VAPI Configuration:
- Create 11 VAPI assistants with system prompts from constants/index.ts
- Set assistant IDs in vapiService.ts initializeAgents()
- Connect TW Twilio account to VAPI

### 2. Twilio Configuration:
- Separate TW Twilio account (HIGH RISK - cold calling volume)
- A2P 10DLC registration (CRITICAL for 320 calls/day)
- Purchase 346 (inbound) and 281 (outbound) numbers
- Configure callback forwarding: 281 → 346

### 3. Supabase Configuration:
- Create `texas-wholesaling` project
- Create 6 tables: leads, deals, buyers, call_logs, comps, contracts
- Enable Realtime on leads and call_logs

### 4. Make.com Configuration:
- Create "Texas Wholesaling" folder
- Build 8 scenarios per deployment blueprint
- Wire webhook URLs into constants/index.ts

### 5. Skip Tracing:
- BatchSkipTracing.com or PropStream account
- Fund with $0.10-0.15/record budget
- Import first 500+ traced leads

## P0 Remaining:
- [ ] VAPI assistant IDs
- [ ] Twilio number configuration
- [ ] Supabase tables creation
- [ ] Make.com webhook URLs
- [ ] First skip tracing batch

## P1 Features:
- [ ] County map visualization
- [ ] Deal analysis calculator (70% rule)
- [ ] Cash buyer matching algorithm
- [ ] Contract deadline alerts

## P2 Features:
- [ ] Comp pulling from PropStream API
- [ ] Auto-generated deal packages
- [ ] Buyer preference learning
