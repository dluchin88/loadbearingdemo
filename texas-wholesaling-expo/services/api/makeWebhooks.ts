// services/api/makeWebhooks.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Make.com Webhook Integration Service
//
// Make.com (formerly Integromat) serves as the automation backbone,
// connecting the Expo app to Supabase, Gmail, Twilio, and other
// external services. This file defines every webhook trigger used
// across the wholesaling pipeline.
//
// PIPELINE FLOW:
// ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
// │  Expo App       │───▶│  Make.com        │───▶│  Supabase       │
// │  (triggers)     │    │  (processes)     │    │  (stores data)  │
// └─────────────────┘    └──────────────────┘    └─────────────────┘
//                               │
//                        ┌──────┼──────┐
//                        ▼      ▼      ▼
//                     Gmail  Twilio  Slack
//                   (emails) (SMS)  (alerts)
//
// WHOLESALING DATA FLOW:
// County Scrapers → Skip Tracing → Leads → Cold Calls → Deals → Buyers
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { API } from "../../constants";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS FOR TEXAS WHOLESALING
// ══════════════════════════════════════════════════════════════════════════════

export interface WholesaleLead {
  id?: string;
  property_address: string;
  city: string;
  county: string;
  zip: string;
  owner_name: string;
  phone_1: string;
  phone_2?: string;
  phone_3?: string;
  data_source: string; // tax_delinquent, probate, pre_foreclosure, etc.
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
  stage?: string;
  assigned_agent?: string;
  do_not_call?: boolean;
  total_attempts?: number;
  last_called_at?: string;
  notes?: string;
  created_at?: string;
}

export interface WholesaleDeal {
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
}

export interface CashBuyer {
  id?: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  buying_criteria?: {
    min_price?: number;
    max_price?: number;
    property_types?: string[];
    preferred_areas?: string[];
    rehab_tolerance?: string;
  };
  preferred_areas?: string[];
  max_price?: number;
  rehab_tolerance?: string;
  cash_or_hard_money?: string;
  deals_purchased?: number;
  last_deal_date?: string;
  is_active?: boolean;
}

export interface CallLog {
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
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: NEW LEAD PIPELINE
// Handles leads from county scrapers + skip tracing
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerNewLeadWebhook — Fires when a new property owner lead is imported
 * from skip tracing results.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives lead data from this webhook
 * 2. Deduplicates against existing leads in Supabase
 * 3. Checks against DNC list
 * 4. If new: inserts into leads table with lead score
 * 5. If motivation score 7+: sends SMS alert to Domonique
 * 6. Queues lead for appropriate cold caller based on county
 */
export async function triggerNewLeadWebhook(lead: Partial<WholesaleLead>) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.NEW_LEAD, {
      action: "new_lead",
      timestamp: new Date().toISOString(),
      data: {
        property_address: lead.property_address,
        city: lead.city,
        county: lead.county,
        zip: lead.zip,
        owner_name: lead.owner_name,
        phone_1: lead.phone_1,
        phone_2: lead.phone_2,
        phone_3: lead.phone_3,
        data_source: lead.data_source,
        property_type: lead.property_type,
        motivation_score: lead.motivation_score,
        stage: lead.stage || "raw_lead",
      },
    });

    return {
      success: true,
      leadId: response.data?.leadId,
      message: "Lead successfully added to pipeline",
    };
  } catch (error: any) {
    console.error("[MAKE] New lead webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: CALL COMPLETED LOGGER
// Tracks every call made by every AI agent
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerCallCompletedWebhook — Fires after every AI agent call ends.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives full call data including transcript summary
 * 2. Inserts into call_logs table in Supabase
 * 3. Updates lead's stage and motivation_score based on outcome
 * 4. If hot lead (7+): sends SMS to Domonique with property details
 * 5. If warm lead: schedules follow-up for Luna
 * 6. Updates agent's daily call metrics
 */
export async function triggerCallCompletedWebhook(callLog: CallLog) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.CALL_COMPLETED, {
      action: "call_completed",
      timestamp: new Date().toISOString(),
      data: {
        agent_id: callLog.agent_id,
        agent_name: callLog.agent_name,
        direction: callLog.direction,
        contact_phone: callLog.contact_phone,
        contact_name: callLog.contact_name,
        lead_id: callLog.lead_id,
        county: callLog.county,
        status: callLog.status,
        start_time: callLog.start_time,
        end_time: callLog.end_time,
        duration: callLog.duration,
        recording_url: callLog.recording_url,
        transcript_summary: callLog.transcript_summary,
        outcome: callLog.outcome,
        motivation_score: callLog.motivation_score,
        vapi_call_id: callLog.vapi_call_id,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Call completed webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: HOT LEAD ALERT
// Immediate notification when a motivated seller is found
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerHotLeadWebhook — Fires when an agent identifies a motivated seller
 * with score 7+ who wants to sell.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives hot lead data from cold caller or Zara
 * 2. Updates lead in Supabase with priority=urgent
 * 3. Sends SMS to Domonique: "Hot seller: [name] at [address], motivation [score]/10"
 * 4. Creates Google Calendar task for same-day callback
 * 5. Flags for immediate Domonique follow-up
 */
export async function triggerHotLeadWebhook(lead: WholesaleLead) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.HOT_LEAD, {
      action: "hot_lead_alert",
      timestamp: new Date().toISOString(),
      data: {
        lead_id: lead.id,
        property_address: lead.property_address,
        city: lead.city,
        county: lead.county,
        owner_name: lead.owner_name,
        phone_1: lead.phone_1,
        motivation_score: lead.motivation_score,
        asking_price: lead.asking_price,
        property_type: lead.property_type,
        condition: lead.condition,
        notes: lead.notes,
        assigned_agent: lead.assigned_agent,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Hot lead webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: DEAL PACKAGE SENDER
// Blaze sends deal packages to cash buyers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerDealPackageWebhook — Fires when Blaze needs to send property details
 * to a cash buyer for disposition.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives deal data from Blaze
 * 2. Compiles property photos, comps, ARV, rehab estimate
 * 3. Generates PDF deal package
 * 4. Emails to buyer
 * 5. Logs in deals table
 */
export async function triggerDealPackageWebhook(
  deal: WholesaleDeal,
  buyer: CashBuyer
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.DEAL_PACKAGE, {
      action: "send_deal_package",
      timestamp: new Date().toISOString(),
      data: {
        deal_id: deal.id,
        property_address: deal.property_address,
        arv: deal.arv,
        rehab_estimate: deal.rehab_estimate,
        contract_price: deal.contract_price,
        assignment_fee: deal.assignment_fee,
        profit_estimate: deal.profit_estimate,
        buyer_name: buyer.name,
        buyer_email: buyer.email,
        buyer_phone: buyer.phone,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Deal package webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: OFFER RELAY
// Buyer makes an offer on a deal
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerOfferWebhook — Fires when a cash buyer makes an offer on a property.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives offer from Blaze
 * 2. Logs in deals table
 * 3. SMS Domonique: "Buyer [name] offers [amount] for [address]"
 * 4. Updates deal status
 */
export async function triggerOfferWebhook(
  deal_id: string,
  buyer: CashBuyer,
  offer_amount: number
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.OFFER_MADE, {
      action: "offer_received",
      timestamp: new Date().toISOString(),
      data: {
        deal_id,
        buyer_id: buyer.id,
        buyer_name: buyer.name,
        buyer_phone: buyer.phone,
        offer_amount,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Offer webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6: CONTRACT SIGNED
// Property goes under contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerContractSignedWebhook — Fires when Domonique gets a property under contract.
 *
 * MAKE.COM SCENARIO:
 * 1. Updates deals status to "under_contract"
 * 2. Notifies Blaze to begin disposition
 * 3. Creates contracts record
 * 4. Alerts title company
 */
export async function triggerContractSignedWebhook(deal: WholesaleDeal) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.CONTRACT_SIGNED, {
      action: "contract_signed",
      timestamp: new Date().toISOString(),
      data: {
        deal_id: deal.id,
        lead_id: deal.lead_id,
        property_address: deal.property_address,
        contract_price: deal.contract_price,
        assignment_fee: deal.assignment_fee,
        contract_signed_date: deal.contract_signed_date,
        closing_date: deal.closing_date,
        earnest_money: deal.earnest_money,
        title_company: deal.title_company,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Contract signed webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7: DAILY REPORT
// End of day summary for Domonique
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerDailyReportWebhook — Fires at 8 AM daily.
 *
 * MAKE.COM SCENARIO:
 * 1. Aggregates previous day's call data by agent and county
 * 2. Counts hot/warm/cold leads
 * 3. Shows active deals and pipeline value
 * 4. Emails/Slacks report to Domonique
 */
export async function triggerDailyReportWebhook(reportDate: string) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.DAILY_REPORT, {
      action: "generate_daily_report",
      timestamp: new Date().toISOString(),
      data: { reportDate },
    });

    return { success: true, reportUrl: response.data?.reportUrl };
  } catch (error: any) {
    console.error("[MAKE] Daily report webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 8: DNC (DO NOT CALL) MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerDNCWebhook — Fires when someone requests to be removed from call list.
 *
 * MAKE.COM SCENARIO:
 * 1. Updates lead: do_not_call=true
 * 2. Removes from ALL agent call queues
 * 3. Logs the DNC request with timestamp
 * 4. Weekly sync with national DNC registry
 */
export async function triggerDNCWebhook(phone: string, lead_id?: string) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.NEW_LEAD, {
      action: "mark_dnc",
      timestamp: new Date().toISOString(),
      data: {
        phone,
        lead_id,
        do_not_call: true,
        dnc_requested_at: new Date().toISOString(),
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] DNC webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LEAD SCORING & FOLLOW-UP SCHEDULING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerFollowUpSchedule — Schedules Luna's follow-up cadence for warm leads.
 *
 * CADENCE: Day 1, 3, 7, 14, 30, 60
 */
export async function triggerFollowUpSchedule(
  lead: WholesaleLead,
  cadence_day: number
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.CALL_COMPLETED, {
      action: "schedule_followup",
      timestamp: new Date().toISOString(),
      data: {
        lead_id: lead.id,
        owner_name: lead.owner_name,
        phone_1: lead.phone_1,
        property_address: lead.property_address,
        cadence_day,
        assigned_agent: "luna",
        scheduled_date: calculateFollowUpDate(cadence_day),
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Follow-up schedule webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate follow-up date based on cadence day.
 */
function calculateFollowUpDate(cadence_day: number): string {
  const date = new Date();
  date.setDate(date.getDate() + cadence_day);
  return date.toISOString();
}

// ══════════════════════════════════════════════════════════════════════════════
// DEAL ANALYSIS HELPERS (70% RULE)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Maximum Allowable Offer using the 70% rule.
 * MAO = (ARV × 0.70) - Repairs - Assignment Fee
 */
export function calculateMAO(
  arv: number,
  rehab_estimate: number,
  assignment_fee: number = 10000
): number {
  return arv * 0.7 - rehab_estimate - assignment_fee;
}

/**
 * Estimate rehab cost based on condition and square footage.
 */
export function estimateRehabCost(
  sqft: number,
  condition: "light" | "moderate" | "heavy" | "structural"
): { min: number; max: number } {
  const rates = {
    light: { min: 15, max: 25 },
    moderate: { min: 25, max: 45 },
    heavy: { min: 45, max: 75 },
    structural: { min: 75, max: 120 },
  };
  const rate = rates[condition];
  return {
    min: sqft * rate.min,
    max: sqft * rate.max,
  };
}
