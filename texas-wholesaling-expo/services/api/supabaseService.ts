// services/api/supabaseService.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Supabase Database Integration
//
// Supabase serves as the CRM/database for the wholesaling operation.
// This service handles all CRUD operations against the Supabase backend.
//
// TABLE STRUCTURE:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ texas-wholesaling Supabase Project                                      │
// ├──────────────┬──────────────────────────────────────────────────────────┤
// │ Table        │ Purpose                                                  │
// ├──────────────┼──────────────────────────────────────────────────────────┤
// │ leads        │ Property owner leads from skip tracing (Enable Realtime) │
// │ deals        │ Properties under contract, active deals                  │
// │ buyers       │ Cash buyer list for Blaze's disposition calls            │
// │ call_logs    │ Every call by every agent (Enable Realtime)              │
// │ comps        │ Comparable sales for ARV calculations                    │
// │ contracts    │ Purchase and assignment contracts                        │
// └──────────────┴──────────────────────────────────────────────────────────┘
//
// DATA FLOW:
// County Scrapers → Skip Tracing → leads table → Cold Callers
// Hot Leads → Domonique → deals table → Blaze → buyers table → Close
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { API } from "../../constants";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export interface Lead {
  id?: string;
  property_address: string;
  city: string;
  county: string;
  zip: string;
  owner_name: string;
  phone_1: string;
  phone_2?: string;
  phone_3?: string;
  data_source: string;
  motivation_score?: number;
  asking_price?: number;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  condition?: string;
  is_vacant?: boolean;
  has_mortgage?: boolean;
  mortgage_balance?: number;
  stage: string;
  assigned_agent?: string;
  do_not_call: boolean;
  total_attempts: number;
  last_called_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Deal {
  id?: string;
  lead_id: string;
  property_address: string;
  arv: number;
  rehab_estimate: number;
  contract_price: number;
  assignment_fee: number;
  max_allowable_offer: number;
  profit_estimate: number;
  status: string;
  contract_signed_date?: string;
  closing_date?: string;
  buyer_id?: string;
  title_company?: string;
  earnest_money?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Buyer {
  id?: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  buying_criteria?: Record<string, any>;
  preferred_areas?: string[];
  max_price?: number;
  rehab_tolerance?: string;
  cash_or_hard_money?: string;
  deals_purchased: number;
  last_deal_date?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CallLogRecord {
  id?: string;
  agent_id: string;
  agent_name: string;
  direction: "inbound" | "outbound";
  contact_phone: string;
  contact_name?: string;
  lead_id?: string;
  county?: string;
  status: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  recording_url?: string;
  transcript_summary?: string;
  outcome?: string;
  motivation_score?: number;
  vapi_call_id?: string;
  created_at?: string;
}

export interface Comp {
  id?: string;
  address: string;
  city: string;
  zip: string;
  sold_price: number;
  sold_date: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  days_on_market: number;
  source: string;
  created_at?: string;
}

export interface DashboardStats {
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  active_deals: number;
  deals_closed_this_month: number;
  pipeline_value: number;
  calls_today: number;
  calls_this_week: number;
  conversion_rate: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADS OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch leads with optional filtering by stage, county, agent, score.
 */
export async function getLeads(filters?: {
  stage?: string;
  county?: string;
  assigned_agent?: string;
  min_score?: number;
  max_score?: number;
  do_not_call?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Lead[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: {
        action: "getAll",
        ...filters,
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch leads:", error.message);
    return [];
  }
}

/**
 * Get a single lead by ID.
 */
export async function getLeadById(leadId: string): Promise<Lead | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: { action: "getById", id: leadId },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch lead:", error.message);
    return null;
  }
}

/**
 * Lookup lead by phone number — used by Zara for inbound caller identification.
 */
export async function getLeadByPhone(phone: string): Promise<Lead | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: { action: "getByPhone", phone },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to lookup lead by phone:", error.message);
    return null;
  }
}

/**
 * Create a new lead — called when cold callers or Zara qualify a new prospect.
 */
export async function createLead(lead: Partial<Lead>): Promise<Lead | null> {
  try {
    const response = await axios.post(API.GOOGLE_SHEETS.LEADS, {
      action: "create",
      data: {
        ...lead,
        stage: lead.stage || "raw_lead",
        do_not_call: false,
        total_attempts: 0,
        created_at: new Date().toISOString(),
      },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to create lead:", error.message);
    return null;
  }
}

/**
 * Update lead stage and/or other fields.
 */
export async function updateLead(
  leadId: string,
  updates: Partial<Lead>
): Promise<boolean> {
  try {
    await axios.post(API.GOOGLE_SHEETS.LEADS, {
      action: "update",
      id: leadId,
      data: {
        ...updates,
        updated_at: new Date().toISOString(),
      },
    });
    return true;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to update lead:", error.message);
    return false;
  }
}

/**
 * Mark lead as Do Not Call — TCPA compliance.
 */
export async function markDoNotCall(leadId: string): Promise<boolean> {
  return updateLead(leadId, {
    do_not_call: true,
    stage: "dnc",
    notes: `DNC requested at ${new Date().toISOString()}`,
  });
}

/**
 * Get leads queue for a specific cold caller by county assignment.
 */
export async function getAgentQueue(
  agentId: string,
  counties: string[],
  limit: number = 50
): Promise<Lead[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: {
        action: "getAgentQueue",
        counties: counties.join(","),
        do_not_call: false,
        stage: "raw_lead,warm_lead",
        limit,
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch agent queue:", error.message);
    return [];
  }
}

/**
 * Check if lead was called today — prevents duplicate calls.
 */
export async function wasCalledToday(phone: string): Promise<boolean> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: {
        action: "checkCalledToday",
        phone,
      },
    });
    return response.data?.calledToday || false;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to check call status:", error.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEALS OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all active deals.
 */
export async function getDeals(filters?: {
  status?: string;
  buyer_id?: string;
}): Promise<Deal[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.DEALS, {
      params: { action: "getAll", ...filters },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch deals:", error.message);
    return [];
  }
}

/**
 * Get a single deal by ID.
 */
export async function getDealById(dealId: string): Promise<Deal | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.DEALS, {
      params: { action: "getById", id: dealId },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch deal:", error.message);
    return null;
  }
}

/**
 * Create a new deal — when Domonique gets a property under contract.
 */
export async function createDeal(deal: Partial<Deal>): Promise<Deal | null> {
  try {
    // Calculate MAO if not provided
    if (!deal.max_allowable_offer && deal.arv && deal.rehab_estimate) {
      deal.max_allowable_offer =
        deal.arv * 0.7 -
        deal.rehab_estimate -
        (deal.assignment_fee || 10000);
    }

    const response = await axios.post(API.GOOGLE_SHEETS.DEALS, {
      action: "create",
      data: {
        ...deal,
        status: deal.status || "under_contract",
        created_at: new Date().toISOString(),
      },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to create deal:", error.message);
    return null;
  }
}

/**
 * Update deal status or details.
 */
export async function updateDeal(
  dealId: string,
  updates: Partial<Deal>
): Promise<boolean> {
  try {
    await axios.post(API.GOOGLE_SHEETS.DEALS, {
      action: "update",
      id: dealId,
      data: {
        ...updates,
        updated_at: new Date().toISOString(),
      },
    });
    return true;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to update deal:", error.message);
    return false;
  }
}

/**
 * Get deals expiring soon — for contract deadline alerts.
 */
export async function getExpiringDeals(daysOut: number = 15): Promise<Deal[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.DEALS, {
      params: {
        action: "getExpiring",
        days: daysOut,
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch expiring deals:", error.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BUYERS OPERATIONS (Cash Buyer List for Disposition)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all active cash buyers.
 */
export async function getBuyers(filters?: {
  is_active?: boolean;
  max_price_min?: number;
  preferred_area?: string;
}): Promise<Buyer[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.BUYERS, {
      params: { action: "getAll", ...filters },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch buyers:", error.message);
    return [];
  }
}

/**
 * Get a single buyer by ID.
 */
export async function getBuyerById(buyerId: string): Promise<Buyer | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.BUYERS, {
      params: { action: "getById", id: buyerId },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch buyer:", error.message);
    return null;
  }
}

/**
 * Find buyers matching a deal's criteria.
 * Used by Blaze to identify who to pitch a deal to.
 */
export async function findMatchingBuyers(deal: Deal): Promise<Buyer[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.BUYERS, {
      params: {
        action: "findMatching",
        price: deal.contract_price + deal.assignment_fee,
        // Add area matching logic based on property address
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to find matching buyers:", error.message);
    return [];
  }
}

/**
 * Update buyer preferences — Blaze tracks what each buyer is looking for.
 */
export async function updateBuyerPreferences(
  buyerId: string,
  preferences: Partial<Buyer>
): Promise<boolean> {
  try {
    await axios.post(API.GOOGLE_SHEETS.BUYERS, {
      action: "update",
      id: buyerId,
      data: {
        ...preferences,
        updated_at: new Date().toISOString(),
      },
    });
    return true;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to update buyer preferences:", error.message);
    return false;
  }
}

/**
 * Check if buyer was already contacted about a specific deal.
 */
export async function wasBuyerContactedForDeal(
  buyerId: string,
  dealId: string
): Promise<boolean> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CALLS, {
      params: {
        action: "checkBuyerDealContact",
        buyer_id: buyerId,
        deal_id: dealId,
      },
    });
    return response.data?.contacted || false;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to check buyer contact:", error.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALL LOGS OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch call logs with optional filtering.
 */
export async function getCallLogs(filters?: {
  agent_id?: string;
  agent_name?: string;
  direction?: string;
  county?: string;
  outcome?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<CallLogRecord[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CALLS, {
      params: { action: "getAll", ...filters },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch call logs:", error.message);
    return [];
  }
}

/**
 * Get today's call summary by agent.
 */
export async function getTodaysCallSummary(): Promise<
  Record<string, { total: number; hot: number; warm: number; cold: number; avgDuration: number }>
> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await axios.get(API.GOOGLE_SHEETS.CALLS, {
      params: { action: "dailySummary", date: today },
    });
    return response.data?.data || {};
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch call summary:", error.message);
    return {};
  }
}

/**
 * Get call count by county — for agent workload balancing.
 */
export async function getCallsByCounty(
  dateFrom: string,
  dateTo: string
): Promise<Record<string, number>> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CALLS, {
      params: { action: "countByCounty", dateFrom, dateTo },
    });
    return response.data?.data || {};
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch calls by county:", error.message);
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPS OPERATIONS (Comparable Sales)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch comps for ARV calculation.
 */
export async function getComps(filters?: {
  zip?: string;
  city?: string;
  min_price?: number;
  max_price?: number;
  property_type?: string;
  days_back?: number;
}): Promise<Comp[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.COMPS, {
      params: { action: "getAll", ...filters },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch comps:", error.message);
    return [];
  }
}

/**
 * Find comps near a specific property for ARV calculation.
 */
export async function findCompsForProperty(
  zip: string,
  sqft: number,
  bedrooms: number
): Promise<Comp[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.COMPS, {
      params: {
        action: "findSimilar",
        zip,
        sqft_min: sqft * 0.8,
        sqft_max: sqft * 1.2,
        bedrooms,
        days_back: 180, // Last 6 months
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SUPABASE] Failed to find property comps:", error.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD & METRICS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch aggregated dashboard statistics.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.LEADS, {
      params: { action: "getDashboardStats" },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch dashboard stats:", error.message);
    return null;
  }
}

/**
 * Get pipeline value — sum of potential assignment fees.
 */
export async function getPipelineValue(): Promise<number> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.DEALS, {
      params: { action: "getPipelineValue" },
    });
    return response.data?.value || 0;
  } catch (error: any) {
    console.error("[SUPABASE] Failed to fetch pipeline value:", error.message);
    return 0;
  }
}
