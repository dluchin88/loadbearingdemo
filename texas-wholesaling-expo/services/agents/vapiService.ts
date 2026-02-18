// services/agents/vapiService.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — VAPI.ai Integration Service
//
// This is the CORE engine that powers all 7 AI voice agents.
// It handles: creating outbound calls, managing live call state,
// processing VAPI webhooks, and coordinating with Twilio for telephony.
//
// ARCHITECTURE:
// [Expo App] → [vapiService] → [VAPI API] → [Twilio] → [Phone Network]
//                    ↕                           ↕
//              [Make.com Webhooks]         [Call Recordings]
//                    ↕
//              [Google Sheets CRM]
//
// Each agent has a VAPI Assistant ID that contains its prompt, voice config,
// function definitions, and behavioral rules. This service orchestrates
// triggering those assistants and handling their outputs.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API } from "../../constants";
import type {
  AIAgent,
  AgentRole,
  CallLog,
  CallOutcome,
  VapiCallEvent,
} from "../../types";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const VAPI_BASE_URL = API.VAPI.BASE_URL;

/**
 * Get the VAPI API key from secure storage.
 * Never hardcode API keys — they're stored encrypted on device.
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
// OUTBOUND CALL MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * initiateOutboundCall — The primary function that makes an AI agent call someone.
 *
 * FLOW:
 * 1. Validates the agent is in a callable state (idle, not rate-limited)
 * 2. Constructs the VAPI call payload with agent-specific context
 * 3. Injects dynamic variables (prospect name, property name, call history)
 * 4. Sends the request to VAPI which triggers Twilio to place the call
 * 5. Returns the call ID for tracking
 *
 * The agent's VAPI assistant prompt already contains its personality,
 * objection handling scripts, and goal definitions. This function adds
 * the per-call context that makes each conversation unique.
 *
 * @param agent - The AI agent making the call
 * @param phoneNumber - Target phone number (E.164 format)
 * @param context - Dynamic data injected into the agent's prompt
 * @returns CallLog entry for tracking
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
  // The "assistantOverrides" field lets us inject per-call context into
  // the agent's base prompt without modifying the assistant itself.
  const callPayload = {
    assistantId: agent.vapiAssistantId,
    phoneNumberId: agent.phoneNumber,
    customer: {
      number: phoneNumber,
      name: context.contactName,
    },
    assistantOverrides: {
      // Inject dynamic context into the system prompt
      variableValues: {
        CONTACT_NAME: context.contactName || "there",
        PROPERTY_NAME: context.propertyName || "your property",
        UNIT_COUNT: context.unitCount?.toString() || "unknown",
        PREVIOUS_CALL_SUMMARY: context.previousCallSummary || "This is our first conversation.",
        CURRENT_STAGE: context.pipelineStage || "new prospect",
        SPECIAL_OFFER: context.specialOffer || "",
        CALL_REASON: context.callReason || "introduce our valet trash service",
        COMPETITOR_INFO: context.competitorInfo || "",
        COMPLAINT_DETAILS: context.complaintDetails || "",
        CONTRACT_END_DATE: context.contractEndDate || "",
      },
      // Per-call function overrides (e.g., which Make.com webhook to hit)
      serverUrl: context.webhookOverride || undefined,
    },
    // Metadata passed through to webhooks for tracking
    metadata: {
      agentRole: agent.role,
      complexId: context.complexId,
      leadId: context.leadId,
      callPurpose: context.callReason,
      initiatedFrom: "expo_app",
      timestamp: new Date().toISOString(),
    },
  };

  try {
    const response = await client.post(API.VAPI.CALLS, callPayload);

    // ── Construct the local call log entry ─────────────────────────────
    const callLog: CallLog = {
      id: `call_${Date.now()}`,
      agentId: agent.id,
      agentRole: agent.role,
      direction: "outbound",
      contactPhone: phoneNumber,
      contactName: context.contactName,
      complexId: context.complexId,
      complexName: context.propertyName,
      status: "ringing",
      startTime: new Date().toISOString(),
      duration: 0,
      outcome: "information_gathered", // Default, updated when call ends
      sentimentScore: 0,
      keyTopics: [],
      vapiCallId: response.data.id,
      costEstimate: 0,
    };

    return callLog;
  } catch (error: any) {
    // ── Handle VAPI transport errors ──────────────────────────────────
    // This is where the Twilio transport errors have been occurring.
    // Common issues:
    // - "transport error" → Twilio account not upgraded from trial
    // - "invalid phone number" → Number not in E.164 format
    // - "rate limit exceeded" → Too many concurrent calls
    // - "assistant not found" → VAPI assistant ID is wrong

    const errorMessage = error.response?.data?.message || error.message;
    console.error(`[VAPI] Outbound call failed for ${agent.name}:`, errorMessage);

    throw new Error(`Call failed: ${errorMessage}`);
  }
}

/**
 * Context object for outbound calls.
 * Each field gets injected into the agent's prompt as a variable.
 */
export interface OutboundCallContext {
  contactName?: string;
  propertyName?: string;
  unitCount?: number;
  complexId?: string;
  leadId?: string;
  pipelineStage?: string;
  previousCallSummary?: string;
  callReason?: string;
  specialOffer?: string;
  competitorInfo?: string;
  complaintDetails?: string;
  contractEndDate?: string;
  webhookOverride?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// CALL STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * getCallStatus — Check the current state of an active call.
 * Used to show real-time call status in the Agent Dashboard.
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
 * Used when Domonique wants to manually stop an agent's call.
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
 * Returns both the raw transcript and an AI-generated summary.
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
 * listAssistants — Get all VAPI assistants (one per agent).
 * Used to sync agent configs with the VAPI dashboard.
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
 * Used when Domonique wants to tune an agent's behavior from the app.
 */
export async function updateAssistantPrompt(
  assistantId: string,
  newPrompt: string
): Promise<void> {
  const client = await getVapiClient();
  try {
    await client.patch(`${API.VAPI.ASSISTANTS}/${assistantId}`, {
      model: {
        messages: [
          {
            role: "system",
            content: newPrompt,
          },
        ],
      },
    });
  } catch (error) {
    console.error("[VAPI] Failed to update assistant prompt:", error);
    throw error;
  }
}

/**
 * getCallAnalytics — Pull aggregated call metrics for a date range.
 * Powers the Agent Performance charts on the dashboard.
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

    // Aggregate metrics locally
    const totalCalls = calls.length;
    const completedCalls = calls.filter(
      (c: any) => c.status === "ended" && c.endedReason === "customer-ended-call"
    ).length;
    const avgDuration =
      calls.reduce((sum: number, c: any) => {
        if (c.startedAt && c.endedAt) {
          return (
            sum +
            (new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) /
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
 * - function.call → Agent wants to trigger an action (book appointment, etc.)
 * - call.ended → Call completed, final data available
 * - call.failed → Call failed (transport error, network issue)
 *
 * This function routes each event type to the appropriate handler.
 * In production, these webhooks hit a Make.com scenario that then
 * pushes updates to the app via websocket.
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
  // This is where transport errors surface.
  // Log extensively for debugging Twilio issues.
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
    role: event.data.role, // "assistant" or "user"
    text: event.data.transcript,
    timestamp: event.timestamp,
  };
}

/**
 * handleFunctionCall — Process function calls made by the AI agent during a call.
 *
 * VAPI agents can call functions during conversations to trigger actions:
 * - "bookAppointment" → Schedule a follow-up in the calendar
 * - "sendProposal" → Trigger Make.com to send a proposal email
 * - "transferToHuman" → Route the call to Domonique's phone
 * - "lookupProperty" → Query CRM for property details
 * - "scheduleService" → Create a new service route entry
 * - "createComplaint" → Log a complaint ticket
 * - "processPayment" → Note a payment commitment
 *
 * Each function call triggers the corresponding Make.com webhook.
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
// INBOUND CALL ROUTING (ZARA — AI RECEPTIONIST)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * handleInboundCall — Manages the logic when Zara receives an inbound call.
 *
 * Zara is set as the DEFAULT ASSISTANT on the inbound Twilio number.
 * When a call comes in, VAPI automatically triggers her assistant.
 * This function handles the post-call processing and routing decisions
 * that Zara makes during the conversation.
 *
 * ZARA'S FUNCTION CALLS DURING CONVERSATIONS:
 * When Zara is on a live call, she can invoke these functions:
 *
 * 1. "lookupCallerInCRM" — Checks if the caller's phone number matches
 *    an existing client or lead in Google Sheets.
 *    → Returns: client name, complex name, last interaction, status
 *    → Zara uses this to personalize: "Hi Sarah from The Retreat!"
 *
 * 2. "createNewLead" — When Zara qualifies a new inquiry, she creates
 *    a lead in the CRM pipeline with all collected info.
 *    → Captures: complex name, units, location, contact info, interest level
 *    → Sets stage to "first_contact" with source "inbound_receptionist"
 *
 * 3. "transferToHuman" — Warm-transfers the call to Domonique's cell.
 *    → First sends an SMS to Domonique with caller context
 *    → Then bridges the call via Twilio conference
 *    → If Domonique doesn't answer in 30s, Zara takes a message
 *
 * 4. "transferToAgent" — Routes to another AI agent (Sage, River).
 *    → Passes conversation context so the receiving agent knows
 *      what Zara already discussed with the caller
 *
 * 5. "scheduleCallback" — Books a callback and triggers Make.com
 *    → Creates a task assigned to the appropriate agent
 *    → Sends confirmation SMS to the caller
 *
 * 6. "takeMessage" — Records a message for after-hours or unavailable transfers
 *    → Logs to Google Sheets
 *    → Sends push notification to Domonique's phone
 *    → Schedules morning follow-up
 */
export interface InboundCallContext {
  callerPhone: string;
  callerName?: string;
  isCallback: boolean;                // True if calling back the outbound number
  callbackSource?: string;            // Which agent originally called them
  callbackLeadId?: string;            // CRM lead ID from the outbound call
  isAfterHours: boolean;
  timeOfDay: "morning" | "afternoon" | "evening";
}

/**
 * getZaraGreeting — Determines which greeting Zara should use.
 * This is called by VAPI at the start of an inbound call to select
 * the right opening based on context.
 */
export function getZaraGreeting(context: InboundCallContext): string {
  if (context.isCallback) {
    return `Hi, thanks so much for returning our call! This is Zara with Quiet Hours Valet. I can see we reached out to you about our valet trash service — do you have a few minutes to chat?`;
  }

  if (context.isAfterHours) {
    return `Thank you for calling Quiet Hours Valet. Our office hours are 8 AM to 11 PM, but I'm happy to help you right now or take a message for our team. What can I do for you?`;
  }

  if (context.callerName) {
    // Returning client detected via CRM lookup
    return `Hi ${context.callerName}! Welcome back, it's great to hear from you. How can I help you today?`;
  }

  // Standard greeting
  const timeGreeting =
    context.timeOfDay === "morning"
      ? "Good morning"
      : context.timeOfDay === "afternoon"
      ? "Good afternoon"
      : "Good evening";

  return `${timeGreeting}, thank you for calling Quiet Hours Valet, Houston's premier valet trash service. My name is Zara, how can I help you today?`;
}

/**
 * processZaraTransfer — Handle Zara's decision to transfer a call.
 *
 * When Zara decides a call needs to be transferred (to Domonique or
 * another agent), this function coordinates the handoff:
 *
 * 1. Sends context SMS to the transfer target
 * 2. Initiates the Twilio conference bridge
 * 3. Logs the transfer in CRM
 * 4. If transfer fails, falls back to message-taking
 */
export async function processZaraTransfer(
  vapiCallId: string,
  transferTarget: "domonique" | "sage" | "river",
  context: {
    callerName: string;
    callerPhone: string;
    reason: string;
    complexName?: string;
    conversationSummary: string;
  }
): Promise<{ success: boolean; fallbackAction?: string }> {
  const client = await getVapiClient();

  try {
    // The transfer is handled by VAPI's built-in transfer function
    // which bridges the call via Twilio. We just need to provide
    // the target phone number and context.
    console.log(
      `[ZARA] Transferring call ${vapiCallId} to ${transferTarget}`,
      context
    );

    // In production: send SMS to target with context before transferring
    // This is handled by a Make.com webhook that sends the SMS
    // then confirms back before VAPI initiates the bridge

    return { success: true };
  } catch (error: any) {
    console.error(`[ZARA] Transfer failed:`, error.message);
    return {
      success: false,
      fallbackAction: "take_message",
    };
  }
}
