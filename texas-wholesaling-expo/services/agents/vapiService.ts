// services/agents/vapiService.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — VAPI.ai Integration Service
//
// This is the CORE engine that powers all 11 AI voice agents:
// - Zara TW (Receptionist) — answers inbound from motivated sellers
// - 8 Cold Callers (Ace, Maya, Eli, Nova, Raven, Jett, Sage, Finn)
// - Luna (Follow-Up Agent) — warm lead nurturing cadence
// - Blaze (Disposition Agent) — sells deals to cash buyers
//
// ARCHITECTURE:
// [Expo App] → [vapiService] → [VAPI API] → [Twilio] → [Phone Network]
//                    ↕                           ↕
//              [Make.com Webhooks]         [Call Recordings]
//                    ↕
//              [Supabase CRM]
//
// TWO-NUMBER SETUP:
// - INBOUND (346): Zara answers. On website, bandit signs, direct mail.
// - OUTBOUND (281): 8 cold callers + Luna + Blaze. Never on marketing.
// - Callbacks from 281 forward to 346, Zara answers with callback context.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API, AgentConfigs, TargetCounties } from "../../constants";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export type AgentRole =
  | "receptionist"
  | "cold_caller"
  | "follow_up"
  | "disposition";

export type AgentStatus =
  | "idle"
  | "on_call"
  | "cooldown"
  | "disabled"
  | "error"
  | "rate_limited";

export interface AIAgent {
  id: string;
  name: string;
  role: AgentRole;
  vapiAssistantId: string;
  phoneNumber: string; // "inbound" or "outbound"
  status: AgentStatus;
  assignedCounties?: string[];
  schedule?: string;
  dailyCallLimit: number;
  totalCallsToday: number;
  totalCallsMade: number;
  activeCallId?: string;
  voiceConfig?: {
    voiceId: string;
    speakingRate: number;
    tone: string;
  };
}

export interface CallLog {
  id: string;
  vapiCallId: string;
  agentId: string;
  agentRole: AgentRole;
  direction: "inbound" | "outbound";
  contactPhone: string;
  contactName?: string;
  leadId?: string;
  propertyAddress?: string;
  county?: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration: number;
  recordingUrl?: string;
  transcriptSummary?: string;
  outcome?: string;
  motivationScore?: number;
  keyTopics?: string[];
  costEstimate?: number;
}

export interface VapiCallEvent {
  type: string;
  callId: string;
  timestamp: string;
  data: any;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const VAPI_BASE_URL = API.VAPI.BASE_URL;

/**
 * Get the VAPI API key from secure storage.
 */
async function getApiKey(): Promise<string> {
  const key = await SecureStore.getItemAsync("vapi_api_key");
  if (!key) throw new Error("VAPI API key not found in secure storage");
  return key;
}

/**
 * Create authenticated axios instance for VAPI requests.
 */
async function getVapiClient() {
  const apiKey = await getApiKey();
  return axios.create({
    baseURL: VAPI_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// OUTBOUND CALL MANAGEMENT — COLD CALLERS, LUNA, BLAZE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Context for outbound wholesaling calls.
 * Variables injected into the agent's system prompt.
 */
export interface OutboundCallContext {
  // Contact info
  contactPhone: string;
  contactName?: string;

  // Property info (for cold callers)
  propertyAddress?: string;
  county?: string;
  dataSource?: string; // tax_delinquent, probate, pre_foreclosure, etc.

  // Lead tracking
  leadId?: string;
  motivationScore?: number;
  previousCallSummary?: string;

  // For Luna (follow-up)
  cadenceDay?: number; // Day 1, 3, 7, 14, 30, 60
  previousAgent?: string;

  // For Blaze (disposition)
  dealId?: string;
  propertyDetails?: {
    arv: number;
    rehabEstimate: number;
    contractPrice: number;
    assignmentFee: number;
    profitEstimate: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    condition: string;
    neighborhood: string;
  };

  // Webhook override for specific scenarios
  webhookOverride?: string;
}

/**
 * initiateOutboundCall — The primary function that makes an AI agent call someone.
 *
 * FLOW:
 * 1. Validates the agent is in a callable state (idle, not rate-limited)
 * 2. Constructs the VAPI call payload with agent-specific context
 * 3. Injects dynamic variables (owner name, property address, county, data source)
 * 4. Sends the request to VAPI which triggers Twilio to place the call
 * 5. Returns the call ID for tracking
 */
export async function initiateOutboundCall(
  agent: AIAgent,
  phoneNumber: string,
  context: OutboundCallContext
): Promise<CallLog> {
  // Validate agent state
  if (agent.status !== "idle") {
    throw new Error(
      `Agent ${agent.name} is not available. Current status: ${agent.status}`
    );
  }

  if (agent.totalCallsToday >= agent.dailyCallLimit) {
    throw new Error(
      `Agent ${agent.name} has reached daily call limit (${agent.dailyCallLimit})`
    );
  }

  const client = await getVapiClient();

  // ── Build the VAPI call payload ───────────────────────────────────────
  // Variables are injected into the master cold calling script
  const callPayload = {
    assistantId: agent.vapiAssistantId,
    phoneNumberId: agent.phoneNumber,
    customer: {
      number: phoneNumber,
      name: context.contactName,
    },
    assistantOverrides: {
      variableValues: {
        // Core injection variables from the master script
        AGENT_NAME: agent.name,
        CONTACT_NAME: context.contactName || "there",
        PROPERTY_ADDRESS: context.propertyAddress || "your property",
        COUNTY_NAME: context.county || "the Houston area",
        DATA_SOURCE: context.dataSource || "property records",

        // Follow-up context (for Luna)
        PREVIOUS_AGENT: context.previousAgent || "",
        PREVIOUS_CALL_SUMMARY:
          context.previousCallSummary || "This is our first conversation.",
        CADENCE_DAY: context.cadenceDay?.toString() || "",

        // Disposition context (for Blaze)
        DEAL_ID: context.dealId || "",
        ARV: context.propertyDetails?.arv?.toString() || "",
        REHAB_ESTIMATE: context.propertyDetails?.rehabEstimate?.toString() || "",
        CONTRACT_PRICE: context.propertyDetails?.contractPrice?.toString() || "",
        ASSIGNMENT_FEE: context.propertyDetails?.assignmentFee?.toString() || "",
        PROFIT_ESTIMATE: context.propertyDetails?.profitEstimate?.toString() || "",
        BEDROOMS: context.propertyDetails?.bedrooms?.toString() || "",
        BATHROOMS: context.propertyDetails?.bathrooms?.toString() || "",
        SQFT: context.propertyDetails?.sqft?.toString() || "",
        CONDITION: context.propertyDetails?.condition || "",
        NEIGHBORHOOD: context.propertyDetails?.neighborhood || "",
      },
      serverUrl: context.webhookOverride || undefined,
    },
    metadata: {
      agentRole: agent.role,
      leadId: context.leadId,
      county: context.county,
      dataSource: context.dataSource,
      initiatedFrom: "expo_app",
      timestamp: new Date().toISOString(),
    },
  };

  try {
    const response = await client.post(API.VAPI.CALLS, callPayload);

    const callLog: CallLog = {
      id: `call_${Date.now()}`,
      agentId: agent.id,
      agentRole: agent.role,
      direction: "outbound",
      contactPhone: phoneNumber,
      contactName: context.contactName,
      leadId: context.leadId,
      propertyAddress: context.propertyAddress,
      county: context.county,
      status: "ringing",
      startTime: new Date().toISOString(),
      duration: 0,
      outcome: "information_gathered",
      motivationScore: context.motivationScore,
      keyTopics: [],
      vapiCallId: response.data.id,
      costEstimate: 0,
    };

    return callLog;
  } catch (error: any) {
    // ── Handle VAPI transport errors ──────────────────────────────────
    // Common issues:
    // - "transport error" → Twilio account not upgraded / A2P not approved
    // - "invalid phone number" → Number not in E.164 format
    // - "rate limit exceeded" → Too many concurrent calls (stagger schedules!)
    // - "assistant not found" → VAPI assistant ID is wrong

    const errorMessage = error.response?.data?.message || error.message;
    console.error(
      `[VAPI] Outbound call failed for ${agent.name}:`,
      errorMessage
    );

    throw new Error(`Call failed: ${errorMessage}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALL STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * getCallStatus — Check the current state of an active call.
 */
export async function getCallStatus(vapiCallId: string) {
  const client = await getVapiClient();
  try {
    const response = await client.get(`${API.VAPI.CALLS}/${vapiCallId}`);
    return response.data;
  } catch (error) {
    console.error("[VAPI] Failed to get call status:", error);
    throw error;
  }
}

/**
 * endCall — Force-terminate an active call.
 */
export async function endCall(vapiCallId: string): Promise<void> {
  const client = await getVapiClient();
  try {
    await client.delete(`${API.VAPI.CALLS}/${vapiCallId}`);
  } catch (error) {
    console.error("[VAPI] Failed to end call:", error);
    throw error;
  }
}

/**
 * getCallTranscript — Retrieve the full transcript after a call ends.
 */
export async function getCallTranscript(vapiCallId: string) {
  const client = await getVapiClient();
  try {
    const response = await client.get(`${API.VAPI.CALLS}/${vapiCallId}`);
    return {
      transcript: response.data.transcript || [],
      summary: response.data.analysis?.summary || "No summary available",
      structuredData: response.data.analysis?.structuredData || {},
      recordingUrl: response.data.recordingUrl,
      duration: response.data.endedAt
        ? Math.round(
            (new Date(response.data.endedAt).getTime() -
              new Date(response.data.startedAt).getTime()) /
              1000
          )
        : 0,
    };
  } catch (error) {
    console.error("[VAPI] Failed to get transcript:", error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * listAssistants — Get all VAPI assistants (11 for Texas Wholesaling).
 */
export async function listAssistants() {
  const client = await getVapiClient();
  try {
    const response = await client.get(API.VAPI.ASSISTANTS);
    return response.data;
  } catch (error) {
    console.error("[VAPI] Failed to list assistants:", error);
    throw error;
  }
}

/**
 * updateAssistantPrompt — Update an agent's system prompt on VAPI.
 */
export async function updateAssistantPrompt(
  assistantId: string,
  newPrompt: string
): Promise<void> {
  const client = await getVapiClient();
  try {
    await client.patch(`${API.VAPI.ASSISTANTS}/${assistantId}`, {
      model: {
        messages: [{ role: "system", content: newPrompt }],
      },
    });
  } catch (error) {
    console.error("[VAPI] Failed to update assistant prompt:", error);
    throw error;
  }
}

/**
 * getCallAnalytics — Pull aggregated call metrics for a date range.
 */
export async function getCallAnalytics(
  assistantId: string,
  startDate: string,
  endDate: string
) {
  const client = await getVapiClient();
  try {
    const response = await client.get(API.VAPI.CALLS, {
      params: {
        assistantId,
        createdAtGt: startDate,
        createdAtLt: endDate,
        limit: 100,
      },
    });

    const calls = response.data;
    const totalCalls = calls.length;
    const completedCalls = calls.filter(
      (c: any) =>
        c.status === "ended" && c.endedReason === "customer-ended-call"
    ).length;
    const avgDuration =
      calls.reduce((sum: number, c: any) => {
        if (c.startedAt && c.endedAt) {
          return (
            sum +
            (new Date(c.endedAt).getTime() -
              new Date(c.startedAt).getTime()) /
              1000
          );
        }
        return sum;
      }, 0) / (totalCalls || 1);

    return {
      totalCalls,
      completedCalls,
      failedCalls: totalCalls - completedCalls,
      averageDuration: Math.round(avgDuration),
      completionRate: totalCalls > 0 ? completedCalls / totalCalls : 0,
    };
  } catch (error) {
    console.error("[VAPI] Failed to get call analytics:", error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOK EVENT PROCESSING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * processVapiWebhook — Handle incoming VAPI webhook events.
 *
 * VAPI sends webhook events for key call lifecycle moments:
 * - call.started → Agent connected, call is live
 * - transcript.update → Real-time transcript chunk
 * - function.call → Agent wants to trigger an action
 * - call.ended → Call completed, final data available
 * - call.failed → Call failed (transport error, network issue)
 */
export function processVapiWebhook(event: VapiCallEvent) {
  switch (event.type) {
    case "call.started":
      return handleCallStarted(event);
    case "call.ended":
      return handleCallEnded(event);
    case "call.failed":
      return handleCallFailed(event);
    case "transcript.update":
      return handleTranscriptUpdate(event);
    case "function.call":
      return handleFunctionCall(event);
    default:
      console.warn("[VAPI] Unknown webhook event type:", event.type);
  }
}

function handleCallStarted(event: VapiCallEvent) {
  return {
    type: "CALL_STARTED" as const,
    callId: event.callId,
    timestamp: event.timestamp,
  };
}

function handleCallEnded(event: VapiCallEvent) {
  return {
    type: "CALL_ENDED" as const,
    callId: event.callId,
    duration: event.data.duration,
    transcript: event.data.transcript,
    summary: event.data.summary,
    outcome: event.data.outcome,
    recordingUrl: event.data.recordingUrl,
    timestamp: event.timestamp,
  };
}

function handleCallFailed(event: VapiCallEvent) {
  console.error("[VAPI] Call failed:", {
    callId: event.callId,
    reason: event.data.reason,
    error: event.data.error,
    timestamp: event.timestamp,
  });

  return {
    type: "CALL_FAILED" as const,
    callId: event.callId,
    reason: event.data.reason || "Unknown failure",
    error: event.data.error,
    timestamp: event.timestamp,
  };
}

function handleTranscriptUpdate(event: VapiCallEvent) {
  return {
    type: "TRANSCRIPT_UPDATE" as const,
    callId: event.callId,
    role: event.data.role,
    text: event.data.transcript,
    timestamp: event.timestamp,
  };
}

/**
 * handleFunctionCall — Process function calls made by AI agents during calls.
 *
 * WHOLESALING FUNCTION CALLS:
 *
 * ZARA TW (Receptionist):
 * - lookupCallerInCRM: Search Supabase leads by phone
 * - createNewLead: Insert new motivated seller
 * - transferToHuman: SMS Domonique + warm transfer for hot sellers
 * - scoreMotivation: Calculate motivation score
 *
 * COLD CALLERS (Ace, Maya, Eli, Nova, Raven, Jett, Sage, Finn):
 * - createHotLead: Motivation 7+, SMS Domonique immediately
 * - createWarmLead: Motivation 4-6, queue for Luna follow-up
 * - createColdLead: Motivation 1-3, schedule 90-day recontact
 * - scheduleFollowup: "Call me next week" specific date
 * - transferToHuman: Owner ready to accept offer NOW
 * - markDoNotCall: DNC request, remove from all lists
 *
 * LUNA (Follow-Up):
 * - escalateForCounterOffer: Seller wants higher price
 * - transferToHuman: Motivation increased since last call
 * - scheduleFollowup: Next cadence touch (Day 1, 3, 7, 14, 30, 60)
 * - markLostToCompetitor: Seller went with another buyer
 *
 * BLAZE (Disposition):
 * - sendDealPackage: Email property details to cash buyer
 * - relayOffer: Buyer made an offer, SMS Domonique
 * - transferToHuman: Buyer ready to close
 * - logBuyerPreference: Track what buyer is looking for
 */
function handleFunctionCall(event: VapiCallEvent) {
  const functionName = event.data.functionCall?.name;
  const parameters = event.data.functionCall?.parameters;

  console.log(`[VAPI] Agent function call: ${functionName}`, parameters);

  return {
    type: "FUNCTION_CALL" as const,
    callId: event.callId,
    functionName,
    parameters,
    timestamp: event.timestamp,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// INBOUND CALL ROUTING — ZARA TW (AI RECEPTIONIST)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Context for Zara's inbound call handling.
 */
export interface InboundCallContext {
  callerPhone: string;
  callerName?: string;
  isCallback: boolean; // True if returning call from outbound 281 number
  callbackAgent?: string; // Which cold caller originally called them
  callbackLeadId?: string; // CRM lead ID from the outbound call
  propertyAddress?: string;
  isAfterHours: boolean;
  timeOfDay: "morning" | "afternoon" | "evening";
}

/**
 * getZaraGreeting — Determines Zara TW's greeting based on context.
 */
export function getZaraGreeting(context: InboundCallContext): string {
  // Callback from outbound number
  if (context.isCallback) {
    const propertyContext = context.propertyAddress
      ? ` I can see we reached out about your property at ${context.propertyAddress}.`
      : ` I can see one of our team members reached out to you recently.`;
    return `Thanks for returning our call! This is Zara.${propertyContext} Do you have a few minutes to chat?`;
  }

  // After hours
  if (context.isAfterHours) {
    return `Thank you for calling. Our regular hours are 9 AM to 7 PM Central, but I'm happy to help you right now. Are you calling about selling a property?`;
  }

  // Known caller from CRM
  if (context.callerName) {
    return `Hi ${context.callerName}! Thanks for calling back. How can I help you today?`;
  }

  // Standard greeting for motivated sellers
  return `Thank you for calling, this is Zara. Are you calling about selling a property?`;
}

/**
 * processZaraTransfer — Handle Zara's decision to transfer a hot seller.
 */
export async function processZaraTransfer(
  vapiCallId: string,
  context: {
    callerName: string;
    callerPhone: string;
    propertyAddress: string;
    motivationScore: number;
    askingPrice?: number;
    conversationSummary: string;
  }
): Promise<{ success: boolean; fallbackAction?: string }> {
  try {
    console.log(
      `[ZARA TW] Transferring hot seller to Domonique:`,
      context
    );

    // In production: Make.com webhook sends SMS to Domonique with context
    // then confirms before VAPI initiates the warm transfer

    return { success: true };
  } catch (error: any) {
    console.error(`[ZARA TW] Transfer failed:`, error.message);
    return {
      success: false,
      fallbackAction: "take_message",
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENT INITIALIZATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build the initial agent list from constants.
 * Maps the 11 TW agents to their VAPI assistants.
 */
export function initializeAgents(): AIAgent[] {
  const agents: AIAgent[] = [];

  // Zara TW — Receptionist
  agents.push({
    id: "zara_tw",
    name: "Zara",
    role: "receptionist",
    vapiAssistantId: "", // Set after VAPI assistant creation
    phoneNumber: "inbound",
    status: "idle",
    dailyCallLimit: 0, // Unlimited for receptionist
    totalCallsToday: 0,
    totalCallsMade: 0,
    voiceConfig: AgentConfigs.receptionist.voiceConfig,
  });

  // 8 Cold Callers
  AgentConfigs.agents.forEach((agentConfig) => {
    agents.push({
      id: agentConfig.id,
      name: agentConfig.name,
      role: "cold_caller",
      vapiAssistantId: "", // Set after VAPI assistant creation
      phoneNumber: "outbound",
      status: "idle",
      assignedCounties: agentConfig.counties,
      schedule: agentConfig.schedule,
      dailyCallLimit: AgentConfigs.cold_caller_template.dailyCallLimit,
      totalCallsToday: 0,
      totalCallsMade: 0,
      voiceConfig: {
        voiceId: agentConfig.voiceId,
        speakingRate: 1.0,
        tone: "professional-friendly",
      },
    });
  });

  // Luna — Follow-Up Agent
  agents.push({
    id: "luna",
    name: "Luna",
    role: "follow_up",
    vapiAssistantId: "",
    phoneNumber: "outbound",
    status: "idle",
    dailyCallLimit: AgentConfigs.follow_up.dailyCallLimit,
    totalCallsToday: 0,
    totalCallsMade: 0,
    voiceConfig: AgentConfigs.follow_up.voiceConfig,
  });

  // Blaze — Disposition Agent
  agents.push({
    id: "blaze",
    name: "Blaze",
    role: "disposition",
    vapiAssistantId: "",
    phoneNumber: "outbound",
    status: "idle",
    dailyCallLimit: AgentConfigs.disposition.dailyCallLimit,
    totalCallsToday: 0,
    totalCallsMade: 0,
    voiceConfig: AgentConfigs.disposition.voiceConfig,
  });

  return agents;
}

/**
 * Get agent by county — finds which cold caller handles a specific county.
 */
export function getAgentByCounty(county: string): string | null {
  const agent = AgentConfigs.agents.find((a) =>
    a.counties.some(
      (c) => c.toLowerCase() === county.toLowerCase()
    )
  );
  return agent?.id || null;
}

/**
 * Check if agent is within their scheduled calling window.
 */
export function isAgentInSchedule(agent: AIAgent): boolean {
  if (!agent.schedule) return true;

  const now = new Date();
  const [startStr, endStr] = agent.schedule.split(" - ");

  const parseTime = (timeStr: string): Date => {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    let hour24 = hours;
    if (period === "PM" && hours !== 12) hour24 += 12;
    if (period === "AM" && hours === 12) hour24 = 0;
    date.setHours(hour24, minutes, 0, 0);
    return date;
  };

  const start = parseTime(startStr);
  const end = parseTime(endStr);

  return now >= start && now <= end;
}
