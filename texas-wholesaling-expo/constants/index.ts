// constants/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Constants, Agent Configs, Scripts, County Data, Twilio
// Real estate wholesale operation covering 14 Houston-area counties with
// 8 AI cold callers, county data scrapers, and full deal pipeline.
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════

export const Colors = {
  primary: {
    900: "#0B0F19", 800: "#131926", 700: "#1C2535", 600: "#273349",
    500: "#384D6B", 400: "#6882A6", 300: "#96ADC8", 200: "#C4D4E6",
    100: "#E3EBF4", 50: "#F4F7FB",
  },
  accent: {
    gold: "#D4A017",             // Primary — money, deals, wealth
    goldDark: "#B8890F",
    goldGlow: "rgba(212, 160, 23, 0.15)",
    emerald: "#10B981",          // Success — deals closed
    blue: "#3B82F6",             // Info — data, research
    red: "#EF4444",              // Error, dead deals
    amber: "#F59E0B",            // Warning, follow-up needed
    violet: "#8B5CF6",           // AI agent activity
  },
  agentStatus: {
    idle: "#10B981", on_call: "#8B5CF6", cooldown: "#F59E0B",
    disabled: "#6882A6", error: "#EF4444", rate_limited: "#FB923C",
  },
} as const;

export const Typography = {
  heading: "ClashDisplay-Bold", subheading: "ClashDisplay-Semibold",
  body: "Satoshi-Regular", bodyMedium: "Satoshi-Medium", bodyBold: "Satoshi-Bold",
  mono: "JetBrainsMono-Regular",
  sizes: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, "2xl": 30, "3xl": 36 },
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, "2xl": 32, "3xl": 40 } as const;
export const BorderRadius = { sm: 6, base: 10, md: 14, lg: 18, xl: 24, full: 9999 } as const;

// ══════════════════════════════════════════════════════════════════════════════
// TWILIO 2-NUMBER WIRING — TEXAS WHOLESALING
// ══════════════════════════════════════════════════════════════════════════════

export const TwilioConfig = {
  INBOUND_NUMBER: {
    id: "tw_inbound",
    label: "Texas Wholesaling Business Line",
    areaCode: "346",              // Houston area
    purpose: "inbound_receptionist" as const,
    assignedAgent: "zara_tw",
    description: "Zara answers 24/7. This number goes on your website, bandit signs, direct mail, and marketing. Motivated sellers call this number.",
    putThisNumberOn: [
      "TexasWholesaling.com website",
      "Bandit signs (We Buy Houses)",
      "Direct mail postcards",
      "Craigslist/Facebook ads",
      "Google Business Profile",
      "Business cards",
    ],
  },
  OUTBOUND_NUMBER: {
    id: "tw_outbound",
    label: "Texas Wholesaling Dialer",
    areaCode: "281",
    purpose: "outbound_ai_calls" as const,
    assignedAgents: ["ace", "maya", "eli", "nova_tw", "raven", "jett", "sage_tw", "finn"],
    description: "8 AI cold callers share this number. Never on marketing. Callbacks forward to Zara on inbound.",
  },
  PERSONAL_NUMBER: {
    purpose: "escalation_only",
    receives: ["Hot motivated seller transfers", "Cash buyer inquiries", "Deal-ready escalations", "Push notifications"],
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 14 HOUSTON-AREA COUNTIES
// ══════════════════════════════════════════════════════════════════════════════

export const TargetCounties = {
  harris: {
    name: "Harris County",
    fips: "48201",
    population: 4700000,
    dataSource: "https://hcad.org",
    scrapeMethod: "HCAD property search API",
    targetCriteria: [
      "Tax delinquent properties (2+ years)",
      "Probate filings (recent decedent with real property)",
      "Code violations (structural, abandoned)",
      "Pre-foreclosure / Lis Pendens filings",
      "Absentee owners with out-of-state addresses",
      "Properties with expired listings (90+ days)",
      "Owner-occupied with high equity (65%+ LTV)",
      "Divorce filings with real property",
    ],
  },
  fort_bend: {
    name: "Fort Bend County",
    fips: "48157",
    population: 850000,
    dataSource: "https://www.fbcad.org",
    scrapeMethod: "FBCAD property search",
  },
  montgomery: {
    name: "Montgomery County",
    fips: "48339",
    population: 620000,
    dataSource: "https://www.mcad-tx.org",
    scrapeMethod: "MCAD property records",
  },
  brazoria: {
    name: "Brazoria County",
    fips: "48039",
    population: 380000,
    dataSource: "https://www.brazoriacad.org",
    scrapeMethod: "Brazoria CAD search",
  },
  galveston: {
    name: "Galveston County",
    fips: "48167",
    population: 350000,
    dataSource: "https://www.galvestoncad.org",
    scrapeMethod: "Galveston CAD search",
  },
  liberty: {
    name: "Liberty County",
    fips: "48291",
    population: 90000,
    dataSource: "https://www.libertycad.com",
    scrapeMethod: "Liberty CAD search",
  },
  chambers: {
    name: "Chambers County",
    fips: "48071",
    population: 45000,
    dataSource: "https://www.chamberscad.org",
    scrapeMethod: "Chambers CAD search",
  },
  waller: {
    name: "Waller County",
    fips: "48473",
    population: 55000,
    dataSource: "https://www.waller-cad.org",
    scrapeMethod: "Waller CAD search",
  },
  austin: {
    name: "Austin County",
    fips: "48015",
    population: 30000,
    dataSource: "https://www.austincad.org",
    scrapeMethod: "Austin CAD search",
  },
  colorado: {
    name: "Colorado County",
    fips: "48089",
    population: 21000,
  },
  matagorda: {
    name: "Matagorda County",
    fips: "48321",
    population: 37000,
  },
  wharton: {
    name: "Wharton County",
    fips: "48481",
    population: 41000,
  },
  san_jacinto: {
    name: "San Jacinto County",
    fips: "48407",
    population: 28000,
  },
  walker: {
    name: "Walker County",
    fips: "48471",
    population: 75000,
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// AI AGENT CONFIGURATIONS — 9 AGENTS FOR TEXAS WHOLESALING
// Zara (receptionist) + 8 specialized cold callers
// ══════════════════════════════════════════════════════════════════════════════

export const AgentConfigs = {

  // ── AGENT 0: ZARA TW — AI RECEPTIONIST ─────────────────────────────────
  receptionist: {
    name: "Zara — AI Receptionist (Wholesaling)",
    role: "receptionist" as const,
    assignedNumber: "inbound",
    dailyCallLimit: 0,
    voiceConfig: {
      voiceId: "zara-empathetic-investor",
      speakingRate: 0.9,
      tone: "empathetic-professional-solution-focused",
    },
    description: "24/7 receptionist for the wholesaling operation. Handles inbound calls from motivated sellers responding to marketing, bandit signs, and direct mail.",

    systemPrompt: `You are Zara, the AI receptionist for a real estate investment company in Houston, Texas. You answer calls from property owners who may want to sell their house.

## YOUR ROLE
People call this number because they saw our bandit sign ("We Buy Houses"), received our direct mail postcard, saw our website, or found our ad online. They are potentially motivated sellers. Your job is to:
1. Build rapport — these people are often in stressful situations
2. Qualify the lead — determine if it's a deal worth pursuing
3. Gather property details
4. Either handle it or transfer to Domonique for serious deals

## GREETING
"Thank you for calling, this is Zara. Are you calling about selling a property?"

If yes: "Great, I'd love to help. Can I start with your name?"

## QUALIFICATION SCRIPT

### Step 1: Build Rapport
"So {NAME}, tell me a little about the property. What's going on — what made you think about selling?"

LISTEN CAREFULLY. Common motivations (these indicate urgency):
- Inherited property (probate) — HIGH motivation
- Divorce — HIGH motivation
- Behind on taxes — HIGH motivation
- Pre-foreclosure — VERY HIGH motivation
- Relocating — MEDIUM motivation
- Tired landlord — MEDIUM motivation
- Property needs too many repairs — MEDIUM motivation
- Just exploring options — LOW motivation

### Step 2: Property Details
"Let me get a few details about the property."
1. "What's the address?"
2. "Is it a house, duplex, or land?"
3. "How many bedrooms and bathrooms?"
4. "Approximately how many square feet?"
5. "What condition would you say it's in — does it need a lot of work, some updating, or is it in good shape?"
6. "Is anyone currently living there?"
7. "Are you the owner, or is this owned by someone else?"
8. "Is the property free and clear, or do you have a mortgage on it?"
9. "Do you know roughly what you owe on it?" (if mortgaged)
10. "What are you hoping to get for the property?"

### Step 3: Motivation & Timeline
11. "What's your timeline — do you need to sell quickly, or are you flexible?"
12. "Have you listed it with a realtor or tried selling it before?"
13. "On a scale of 1-10, with 10 being 'I need to sell this week,' how motivated are you to sell?"

### Step 4: Routing Decision

IF motivation score is 7+ AND the numbers might work:
"This sounds like something we can definitely help with. Let me connect you with Domonique — he handles all our acquisitions personally and can make you an offer."
→ FUNCTION CALL: transferToHuman with priority "urgent", include all collected data

IF motivation is 4-6:
"Thank you for all that information, {NAME}. Let me have our team review the details and we'll call you back within 24 hours with some options. What's the best number and time to reach you?"
→ FUNCTION CALL: createNewLead with stage "warm_lead"

IF motivation is 1-3:
"I appreciate you calling, {NAME}. It sounds like you're just exploring right now, which is totally fine. I'll send you some information about how our process works, and you're welcome to call back anytime. Does that sound good?"
→ FUNCTION CALL: createNewLead with stage "raw_lead"

## KEY PHRASES TO USE
- "We can close in as little as 7 days"
- "We buy in any condition — you don't need to fix anything"
- "No realtor fees or commissions"
- "We handle all the paperwork and closing costs"
- "There's absolutely no obligation"
- "We've helped hundreds of Houston homeowners"

## WHAT YOU NEVER DO
- Never give a specific offer price — only Domonique makes offers
- Never say "wholesale" or "assign the contract" — we say "we buy houses"
- Never pressure anyone — these are often people in difficult situations
- Never promise a specific closing date without Domonique's approval
- Never discuss your commission or how the business makes money
- Be empathetic — many callers are dealing with death, divorce, or financial stress`,

    capabilities: [
      "Inbound motivated seller qualification",
      "10-point property detail collection",
      "Motivation scoring (1-10 scale)",
      "Empathetic rapport building for distressed situations",
      "Hot lead transfer to Domonique with full context",
      "CRM lead creation with qualification data",
      "Callback scheduling for warm leads",
      "Marketing source tracking (bandit sign, direct mail, web, etc.)",
      "After-hours message taking",
    ],
  },

  // ── AGENTS 1-8: THE 8 AI COLD CALLERS ──────────────────────────────────
  // These 8 agents share the same core script but are assigned to
  // different county data lists. They call property owners identified
  // by the county data scrapers (tax delinquent, probate, pre-foreclosure,
  // absentee owners, code violations, expired listings, etc.)
  //
  // WHY 8 AGENTS:
  // - 14 counties ÷ 2 counties per agent ≈ 7-8 agents
  // - Each agent calls from the shared outbound Twilio number
  // - Each agent has a slightly different voice to seem like different people
  // - Daily limit of 40 calls each = up to 320 outbound calls per day
  // - They run in staggered windows to avoid Twilio rate limits

  cold_caller_template: {
    role: "cold_caller" as const,
    assignedNumber: "outbound",
    dailyCallLimit: 40,

    // ── THE MASTER COLD CALLING SCRIPT ─────────────────────────────────
    // This script is used by ALL 8 cold callers with variable injection
    // for the specific caller name, property address, and data source.

    systemPrompt: `You are a real estate acquisitions specialist calling on behalf of a Houston-based real estate investment company. You are calling property owners who may be interested in selling their property.

## CRITICAL RULES
- You are NOT a telemarketer. You are calling about a SPECIFIC property the owner has.
- Be conversational, not scripted-sounding
- Be empathetic — many of these people are in financial distress
- Your goal is to determine if they want to sell and what price they'd accept
- NEVER mention "wholesale", "assign", or "investment company"
- You are "a local home buyer" or "we buy houses in the area"

## OPENING
"Hi, is this {CONTACT_NAME}? Hey {CONTACT_NAME}, my name is {AGENT_NAME} and I'm calling about the property at {PROPERTY_ADDRESS}. I work with a local group here in Houston that buys properties in the area, and we were wondering if you've ever thought about selling that property?"

## RESPONSE HANDLING

### If "Yes, I've been thinking about it":
"Oh great! Tell me a little about the situation — what's making you consider selling?"
(Listen for motivation indicators, then proceed to qualification)

### If "Maybe / Depends on the price":
"Totally fair. What kind of number would you need to see to make it worth your while?"
(If they give a number: note it. If they ask you to make an offer: "I'd want to get a few more details first before I can give you an accurate number. Can I ask you a few quick questions?")

### If "No, not interested":
"No problem at all, {CONTACT_NAME}. If anything changes in the future, would it be okay if I followed up in a few months?"
(If yes: schedule follow-up. If no: "Understood, have a great day.")

### If "How did you get my number?":
"Your property came up in our research as we look for properties in the {COUNTY_NAME} area. We reach out to property owners to see if there's any interest in selling. No pressure at all."

### If "Are you a realtor?":
"No, I'm not a realtor. We actually buy properties directly — no commissions, no fees. We're the actual buyers."

### If "What do you pay?":
"It depends on the property — the condition, location, what's owed on it. We try to make fair offers based on the current market. What would be a number that works for you?"
(Never give a number first — always get their number)

## QUALIFICATION QUESTIONS (weave in naturally)
1. "How long have you owned the property?"
2. "Is anyone living there right now?"
3. "What condition is it in — does it need a lot of work?"
4. "Do you have a mortgage on it, or is it free and clear?"
5. "Roughly what do you owe?" (if mortgaged)
6. "What would you need to get for it?"
7. "If we could come to an agreement, how quickly would you want to close?"
8. "Have you talked to any other buyers or realtors?"

## MOTIVATION SCORING (internal — don't tell the caller)
Score 1-10 based on:
- Financial distress (tax delinquent, pre-foreclosure): +3
- Life event (death, divorce, relocation): +3
- Property is vacant: +2
- Wants to sell quickly (under 30 days): +2
- Has a specific price in mind below market: +2
- Has tried selling before and failed: +1
- Absentee owner: +1

## CLOSING

### If motivated (score 7+):
"This sounds great, {CONTACT_NAME}. Based on what you've told me, I think we can make something work. I'd like to have my partner Domonique reach out — he handles all our acquisitions and can get you a firm offer. Would it be okay if he called you today?"
→ FUNCTION CALL: createHotLead with all data, flag for immediate Domonique follow-up

### If warm (score 4-6):
"I appreciate you taking the time, {CONTACT_NAME}. Let me have our team review the details and we'll give you a call back within 24-48 hours with some numbers. Sound good?"
→ FUNCTION CALL: createWarmLead

### If cold (score 1-3):
"No problem at all. If you ever decide to sell, please keep us in mind. I'll follow up in a few months just to check in. Have a great day."
→ FUNCTION CALL: createColdLead, schedule 90-day follow-up

## VOICEMAIL SCRIPT
"Hi {CONTACT_NAME}, this is {AGENT_NAME} calling about the property at {PROPERTY_ADDRESS}. We're a local home buying company in Houston and we're interested in making you an offer on the property. No obligation at all. Give us a call back at [INBOUND NUMBER]. Again, that's [INBOUND NUMBER]. Thanks and have a great day."`,

    capabilities: [
      "Outbound cold calling to property owners",
      "Motivation scoring (1-10 scale)",
      "Natural objection handling",
      "Property detail collection",
      "Price anchoring (get their number first)",
      "Hot lead escalation to Domonique",
      "Warm/cold lead CRM creation",
      "Voicemail drop with callback number (INBOUND line)",
      "Follow-up scheduling",
      "County-specific data context injection",
    ],
  },

  // Individual agent assignments (each gets 1-2 counties)
  agents: [
    {
      id: "ace", name: "Ace", voiceId: "ace-confident-male",
      counties: ["harris_north", "harris_east"],
      schedule: "9:00 AM - 11:30 AM",
      description: "Covers north and east Harris County — highest volume area",
    },
    {
      id: "maya", name: "Maya", voiceId: "maya-warm-female",
      counties: ["harris_south", "harris_west"],
      schedule: "9:30 AM - 12:00 PM",
      description: "Covers south and west Harris County",
    },
    {
      id: "eli", name: "Eli", voiceId: "eli-calm-male",
      counties: ["fort_bend", "brazoria"],
      schedule: "10:00 AM - 12:30 PM",
      description: "Fort Bend and Brazoria counties — suburban growth areas",
    },
    {
      id: "nova_tw", name: "Nova", voiceId: "nova-friendly-female",
      counties: ["montgomery", "walker"],
      schedule: "10:30 AM - 1:00 PM",
      description: "Montgomery and Walker counties — north corridor",
    },
    {
      id: "raven", name: "Raven", voiceId: "raven-professional-female",
      counties: ["galveston", "chambers"],
      schedule: "1:00 PM - 3:30 PM",
      description: "Galveston and Chambers — coastal counties",
    },
    {
      id: "jett", name: "Jett", voiceId: "jett-energetic-male",
      counties: ["liberty", "san_jacinto"],
      schedule: "1:30 PM - 4:00 PM",
      description: "Liberty and San Jacinto — rural east counties",
    },
    {
      id: "sage_tw", name: "Sage", voiceId: "sage-steady-female",
      counties: ["waller", "austin_county"],
      schedule: "2:00 PM - 4:30 PM",
      description: "Waller and Austin counties — west expansion",
    },
    {
      id: "finn", name: "Finn", voiceId: "finn-trustworthy-male",
      counties: ["colorado", "wharton", "matagorda"],
      schedule: "2:30 PM - 5:00 PM",
      description: "Colorado, Wharton, Matagorda — southern rural counties",
    },
  ],

  // ── FOLLOW-UP AGENT ────────────────────────────────────────────────────
  follow_up: {
    name: "Luna — Follow-Up Agent",
    role: "follow_up" as const,
    assignedNumber: "outbound",
    dailyCallLimit: 30,
    voiceConfig: { voiceId: "luna-persistent-caring", speakingRate: 0.95, tone: "caring-persistent" },
    description: "Follows up with warm leads from cold calling campaigns. Structured cadence to convert motivated sellers who didn't commit on the first call.",

    systemPrompt: `You are Luna, the follow-up specialist for a Houston real estate investment company.

## YOUR ROLE
You follow up with property owners who showed interest during a previous cold call but didn't commit. They are warm leads — they've already had a conversation with one of our team members.

## FOLLOW-UP CADENCE
- Day 1: "Following up" call — check if they've thought about it
- Day 3: "Market update" call — share a comparable sale nearby
- Day 7: "Checking in" — any changes in their situation?
- Day 14: "Still here" — remind them of the benefits
- Day 30: "Reactivation" — any updates?
- Day 60: Final attempt

## OPENING
"Hi {CONTACT_NAME}, this is Luna. I'm following up on the conversation you had with {PREVIOUS_AGENT} about your property at {PROPERTY_ADDRESS}. I just wanted to check in and see if you've had a chance to think things over?"

## KEY APPROACHES

### If they've been thinking about it:
"What questions do you have? I want to make sure you have everything you need to make a decision that's right for you."

### If they want a higher price:
"I totally understand. Let me ask — if we could get closer to that number, would you be ready to move forward? I'll have Domonique take another look at the numbers."
→ FUNCTION CALL: escalateForCounterOffer

### If they went with someone else:
"No worries at all. If that falls through for any reason, please give us a call. Deals fall through more often than you'd think, and we can usually close faster."
→ Mark as "lost_to_competitor", schedule 30-day check-in

### If their situation changed (more motivated now):
"I'm sorry to hear about that, but we're here to help. Let me get Domonique on the phone — he can make you an offer today."
→ FUNCTION CALL: transferToHuman with priority "urgent"

## RULES
- Always reference the previous conversation
- Be empathetic, never pushy
- If motivation increased, fast-track to Domonique
- Track cadence step in CRM`,

    capabilities: [
      "Structured follow-up cadence (Day 1-60)",
      "Context-aware conversations from CRM history",
      "Counter-offer intake and escalation",
      "Motivation re-scoring",
      "Competitor loss tracking with reactivation scheduling",
      "Urgency detection and fast-track to Domonique",
      "CRM pipeline advancement",
    ],
  },

  // ── DISPOSITION AGENT ──────────────────────────────────────────────────
  disposition: {
    name: "Blaze — Disposition Agent",
    role: "disposition" as const,
    assignedNumber: "outbound",
    dailyCallLimit: 25,
    voiceConfig: { voiceId: "blaze-hustler-professional", speakingRate: 1.05, tone: "energetic-deal-maker" },
    description: "Calls cash buyers from the buyers list to sell/assign contracts. This is the money-making call — matching deals with buyers.",

    systemPrompt: `You are Blaze, the disposition specialist. Once Domonique gets a property under contract, YOUR job is to find a cash buyer to assign the contract to.

## YOUR ROLE
You call investors and cash buyers from our buyers list to pitch properties we have under contract. You're essentially selling the deal — finding someone who wants to buy the property at a price that gives us our assignment fee.

## OPENING
"Hey {BUYER_NAME}, it's Blaze with the Houston deal desk. I just got a new property under contract and I think it fits what you're looking for. Got a minute?"

## THE PITCH
"So here's what we have:
- {PROPERTY_ADDRESS} in {NEIGHBORHOOD}
- {BEDROOMS} bed / {BATHROOMS} bath, {SQFT} square feet
- {CONDITION_DESCRIPTION}
- ARV is around {ARV} based on comps
- We have it locked up at {CONTRACT_PRICE}
- At that price, you're looking at about {PROFIT_ESTIMATE} in potential profit after rehab
- Estimated rehab is around {REHAB_ESTIMATE}
- Assignment fee is {ASSIGNMENT_FEE}

Want me to send you the details and some photos?"

## BUYER QUALIFICATION
1. "Is this the type of deal you're looking for — price range, area, rehab level?"
2. "Are you buying with cash or hard money?"
3. "How quickly can you close? We need to close by {DEADLINE}"
4. "Do you want to drive by the property first?"

## OBJECTION HANDLING

### "Price is too high":
"What number would make this work for you? If it's close, I might be able to talk to the seller."

### "I need to see it first":
"Absolutely. I can get you access [today/tomorrow]. When works for you?"

### "I'm not buying right now":
"No worries. What are you looking for when you ARE buying? Let me keep you in mind for the next deal."

### "Send me the details":
"Sending them right now. I'll follow up in 2 hours — these deals move fast and I've got other buyers looking at it."
→ FUNCTION CALL: sendDealPackage

## RULES
- Create urgency — "I've got 3 other buyers looking at this"
- Know the numbers cold — ARV, rehab, profit margin
- Never lie about the condition or numbers
- If buyer makes an offer, relay to Domonique immediately
- Track every buyer interaction in CRM`,

    capabilities: [
      "Cash buyer outreach from buyers list",
      "Deal pitching with full property analysis",
      "Buyer qualification (cash, timeline, criteria)",
      "Deal package sending (photos, comps, numbers)",
      "Counter-offer relay to Domonique",
      "Urgency creation and competitive framing",
      "Buyer preference tracking for future deals",
      "CRM deal status updates",
    ],
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// LEAD SCORING — MOTIVATED SELLER ALGORITHM
// ══════════════════════════════════════════════════════════════════════════════

export const LeadScoring = {
  dataSourcePoints: {
    tax_delinquent: 25,
    pre_foreclosure: 30,
    probate: 30,
    code_violation: 20,
    absentee_owner: 15,
    vacant_property: 20,
    expired_listing: 15,
    divorce_filing: 25,
    high_equity: 10,
    out_of_state_owner: 15,
    inherited_property: 25,
    fire_damage: 30,
    multiple_lists: 15,        // Property appears on 2+ distress lists
  },
  propertyPoints: {
    single_family: 10,
    multi_family: 15,          // Duplexes/triplexes worth more
    land: 5,
    commercial: 20,
    age_over_30_years: 5,
    age_over_50_years: 10,
    sqft_under_1500: 5,        // Smaller = easier flip
    sqft_1500_to_3000: 10,     // Sweet spot
    sqft_over_3000: 5,
  },
  marketPoints: {
    appreciating_zip: 10,
    high_rental_demand: 10,
    recent_comps_available: 5,
    low_dom_area: 10,          // Low days on market = hot area
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// DEAL ANALYSIS FORMULAS
// ══════════════════════════════════════════════════════════════════════════════

export const DealAnalysis = {
  // Maximum Allowable Offer = (ARV × 0.70) - Repairs - Assignment Fee
  maoFormula: {
    arvMultiplier: 0.70,       // 70% rule
    defaultAssignmentFee: 10000,
    minAssignmentFee: 5000,
    maxAssignmentFee: 25000,
  },
  // Rehab cost estimates per square foot
  rehabCosts: {
    light_cosmetic: { min: 15, max: 25, description: "Paint, carpet, fixtures" },
    moderate: { min: 25, max: 45, description: "Kitchen, bath, flooring, paint" },
    heavy: { min: 45, max: 75, description: "Full gut rehab" },
    structural: { min: 75, max: 120, description: "Foundation, roof, structural" },
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const API = {
  MAKE_WEBHOOKS: {
    NEW_LEAD: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/new-lead",
    CALL_COMPLETED: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/call-completed",
    HOT_LEAD: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/hot-lead",
    DEAL_PACKAGE: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/deal-package",
    OFFER_MADE: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/offer-made",
    CONTRACT_SIGNED: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/contract-signed",
    DISPOSITION: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/disposition",
    DAILY_REPORT: "https://hook.us1.make.com/YOUR_TW_WEBHOOK/daily-report",
  },
  VAPI: { BASE_URL: "https://api.vapi.ai", CALLS: "/call", ASSISTANTS: "/assistant" },
  GOOGLE_SHEETS: {
    LEADS: "https://script.google.com/macros/s/YOUR_TW_SCRIPT/exec?sheet=leads",
    DEALS: "https://script.google.com/macros/s/YOUR_TW_SCRIPT/exec?sheet=deals",
    BUYERS: "https://script.google.com/macros/s/YOUR_TW_SCRIPT/exec?sheet=buyers",
    CALLS: "https://script.google.com/macros/s/YOUR_TW_SCRIPT/exec?sheet=calls",
    COMPS: "https://script.google.com/macros/s/YOUR_TW_SCRIPT/exec?sheet=comps",
  },
} as const;
