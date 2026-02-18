# 💰 Texas Wholesaling — Expo Mobile App

> AI-Powered Real Estate Wholesale Operation — 14 Counties, 8 Cold Callers

## The 11 AI Agents

| # | Name | Role | Number | Counties | What It Does |
|---|------|------|--------|----------|-------------|
| 0 | **Zara** | Receptionist | INBOUND | All | Handles motivated seller callbacks from bandit signs, direct mail, website |
| 1 | **Ace** | Cold Caller | OUTBOUND | Harris N/E | Tax delinquent, probate, pre-foreclosure leads |
| 2 | **Maya** | Cold Caller | OUTBOUND | Harris S/W | Same script, different voice, different area |
| 3 | **Eli** | Cold Caller | OUTBOUND | Fort Bend, Brazoria | Suburban growth areas |
| 4 | **Nova** | Cold Caller | OUTBOUND | Montgomery, Walker | North corridor |
| 5 | **Raven** | Cold Caller | OUTBOUND | Galveston, Chambers | Coastal counties |
| 6 | **Jett** | Cold Caller | OUTBOUND | Liberty, San Jacinto | Rural east |
| 7 | **Sage** | Cold Caller | OUTBOUND | Waller, Austin Co. | West expansion |
| 8 | **Finn** | Cold Caller | OUTBOUND | Colorado, Wharton, Matagorda | Southern rural |
| 9 | **Luna** | Follow-Up | OUTBOUND | All | 6-touch cadence for warm leads (Day 1-60) |
| 10 | **Blaze** | Disposition | OUTBOUND | All | Calls cash buyers to sell/assign contracts |

## Twilio 2-Number Setup
- **INBOUND (346):** Zara answers. On bandit signs, direct mail, website, Craigslist/FB ads.
- **OUTBOUND (281):** All 8 cold callers + Luna + Blaze. Never public. Callbacks → Zara.
- **Your cell:** Hot motivated seller transfers and deal-closing calls only.

## 14 Target Counties
Harris, Fort Bend, Montgomery, Brazoria, Galveston, Liberty, Chambers, Waller, Austin, Colorado, Matagorda, Wharton, San Jacinto, Walker

## Lead Sources (County Data Scrapers)
- Tax delinquent properties (2+ years behind)
- Probate filings (inherited property)
- Pre-foreclosure / Lis Pendens
- Code violations (structural, abandoned)
- Absentee owners (out-of-state address)
- Expired listings (90+ days DOM)
- Divorce filings with real property

## Deal Analysis Built In
- **70% Rule MAO:** (ARV × 0.70) - Repairs - Assignment Fee
- **Rehab estimates:** Light ($15-25/sqft) to Heavy ($45-75/sqft)
- **Assignment fees:** $5K-$25K per deal
- **Lead scoring:** 10+ factor algorithm with auto-prioritization

## Daily Call Capacity
8 agents × 40 calls/day = **320 outbound calls per day** across all 14 counties

## Key Files
- `constants/index.ts` — ALL agent scripts (especially the master cold calling script), county data, lead scoring algorithm, deal analysis formulas, Twilio wiring
- `types/index.ts` — Customize from LBD types (deals, leads, buyers, comps, contracts)
- `services/` — Same VAPI/Make/Sheets pattern as QHV and LBD

## Google Sheets Structure
| Tab | Purpose |
|-----|---------|
| Leads | All property owner leads by county and source |
| Deals | Properties under contract with deal analysis |
| Buyers | Cash buyer list with preferences and history |
| Call Log | Every agent call with motivation score and outcome |
| Comps | Comparable sales data for ARV calculations |
| Dashboard | Pipeline metrics, call stats, deal flow |

## Critical: Skip Tracing
Your county data scrapers find properties, but you need PHONE NUMBERS to call them. You need a skip tracing service (BatchSkipTracing, PropStream, or similar) to match property owner names/addresses to phone numbers. Budget ~$0.10-0.15 per trace. This is the fuel for the cold callers.
