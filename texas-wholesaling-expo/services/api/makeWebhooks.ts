// services/api/makeWebhooks.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Make.com Webhook Integration Service
//
// Make.com (formerly Integromat) serves as the automation backbone,
// connecting the Expo app to Google Sheets, Gmail, Twilio, and other
// external services. This file defines every webhook trigger used
// across the 7-step automation pipeline.
//
// PIPELINE FLOW:
// ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
// │  Expo App   │───▶│  Make.com     │───▶│  Google Sheets   │
// │  (triggers) │    │  (processes)  │    │  (stores data)   │
// └─────────────┘    └──────────────┘    └─────────────────┘
//                           │
//                    ┌──────┼──────┐
//                    ▼      ▼      ▼
//                 Gmail  Twilio  Slack
//               (emails) (SMS)  (alerts)
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { API } from "../../constants";
import type {
  PipelineLead,
  ApartmentComplex,
  CallLog,
  ServiceRoute,
  Invoice,
} from "../../types";

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: PROSPECT PIPELINE WEBHOOKS
// These webhooks handle the flow of new leads into the CRM.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerNewLeadWebhook — Fires when the Prospector Agent discovers
 * a new apartment complex worth pursuing.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives prospect data from this webhook
 * 2. Checks for duplicates in Google Sheets "Prospects" tab
 * 3. If new: adds row to Prospects sheet with lead score
 * 4. If high-score (80+): sends Slack alert to #new-prospects channel
 * 5. Triggers the Outreach Agent queue to add this prospect
 * 6. Sends confirmation back to the app
 */
export async function triggerNewLeadWebhook(lead: Partial<PipelineLead>) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.NEW_LEAD, {
      action: "new_prospect",
      timestamp: new Date().toISOString(),
      data: {
        complexName: lead.complexName,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        totalUnits: lead.totalUnits,
        contactName: lead.contact?.name,
        contactPhone: lead.contact?.phone,
        contactEmail: lead.contact?.email,
        source: lead.source,
        score: lead.score,
        estimatedMonthlyValue: lead.estimatedMonthlyValue,
        tags: lead.tags,
      },
    });

    return {
      success: true,
      sheetsRowId: response.data?.rowId,
      message: "Lead successfully pushed to CRM pipeline",
    };
  } catch (error: any) {
    console.error("[MAKE] New lead webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: CALL ACTIVITY WEBHOOKS
// Track every call made by every agent for reporting and optimization.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerCallCompletedWebhook — Fires after every AI agent call ends.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives full call data including transcript summary
 * 2. Logs to Google Sheets "Call Log" tab
 * 3. Updates the lead's stage in "Prospects" sheet based on outcome
 * 4. If outcome is "appointment_set" → Creates Google Calendar event
 * 5. If outcome is "proposal_sent" → Triggers proposal email scenario
 * 6. If outcome is "escalated_to_human" → Sends SMS to Domonique
 * 7. Updates daily call count metrics in "Dashboard" sheet
 */
export async function triggerCallCompletedWebhook(callLog: CallLog) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.CALL_COMPLETED, {
      action: "call_completed",
      timestamp: new Date().toISOString(),
      data: {
        callId: callLog.id,
        vapiCallId: callLog.vapiCallId,
        agentId: callLog.agentId,
        agentRole: callLog.agentRole,
        direction: callLog.direction,
        contactPhone: callLog.contactPhone,
        contactName: callLog.contactName,
        complexId: callLog.complexId,
        complexName: callLog.complexName,
        duration: callLog.duration,
        outcome: callLog.outcome,
        sentimentScore: callLog.sentimentScore,
        transcriptSummary: callLog.transcriptSummary,
        keyTopics: callLog.keyTopics,
        nextAction: callLog.nextAction,
        recordingUrl: callLog.recordingUrl,
        costEstimate: callLog.costEstimate,
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Call completed webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3: PROPOSAL GENERATION WEBHOOKS
// Automate the creation and delivery of service proposals.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerProposalWebhook — Fires when an AI agent determines a
 * prospect is ready to receive a formal proposal.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives prospect details and pricing tier
 * 2. Generates a PDF proposal from Google Docs template
 * 3. Personalizes the proposal with:
 *    - Property name, address, unit count
 *    - Custom pricing based on unit count tiers
 *    - Service schedule recommendation
 *    - Testimonials from similar-sized complexes
 * 4. Sends proposal via Gmail to the property manager
 * 5. Creates a follow-up task for the Follow-Up Agent (Day 2)
 * 6. Updates lead stage to "proposal_sent" in CRM
 * 7. Logs proposal details in "Proposals" Google Sheet tab
 */
export async function triggerProposalWebhook(
  lead: PipelineLead,
  pricingTier: "standard" | "premium" | "enterprise"
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.PROPOSAL_TRIGGER, {
      action: "send_proposal",
      timestamp: new Date().toISOString(),
      data: {
        leadId: lead.id,
        complexName: lead.complexName,
        address: lead.address,
        totalUnits: lead.totalUnits,
        contactName: lead.contact.name,
        contactEmail: lead.contact.email,
        pricingTier,
        estimatedMonthlyRate: calculateMonthlyRate(lead.totalUnits, pricingTier),
        recommendedSchedule: recommendSchedule(lead.totalUnits),
        previousInteractions: lead.totalTouchpoints,
      },
    });

    return { success: true, proposalId: response.data?.proposalId };
  } catch (error: any) {
    console.error("[MAKE] Proposal webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4: CLIENT ONBOARDING WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerOnboardingCompleteWebhook — Fires when the Onboarding Agent
 * finishes collecting all setup information from a new client.
 *
 * MAKE.COM SCENARIO:
 * 1. Receives complete client setup data
 * 2. Creates new row in "Active Clients" Google Sheet
 * 3. Creates the client record in the route planning sheet
 * 4. Generates welcome email with service details
 * 5. Sends setup confirmation to Domonique via Slack
 * 6. Schedules 7-day check-in call for the Service Coordinator
 * 7. Updates pipeline: moves lead from "closing" to "won"
 */
export async function triggerOnboardingCompleteWebhook(
  client: Partial<ApartmentComplex>
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.ONBOARDING_COMPLETE, {
      action: "onboarding_complete",
      timestamp: new Date().toISOString(),
      data: {
        complexName: client.name,
        address: client.address,
        totalUnits: client.totalUnits,
        activeUnits: client.activeUnits,
        monthlyRate: client.monthlyRate,
        propertyManager: client.propertyManager,
        serviceSchedule: client.serviceSchedule,
        specialInstructions: client.specialInstructions,
        contractStartDate: client.contractStartDate,
      },
    });

    return { success: true, clientId: response.data?.clientId };
  } catch (error: any) {
    console.error("[MAKE] Onboarding complete webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 5: ROUTE & SERVICE WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerRouteUpdateWebhook — Fires when routes are created, modified,
 * or completed for the night.
 *
 * MAKE.COM SCENARIO:
 * 1. Updates "Routes" Google Sheet with tonight's route data
 * 2. If route completed: calculates service metrics
 * 3. Generates completion report
 * 4. Notifies property managers of any skipped units (with reasons)
 * 5. Updates billing records with actual units serviced
 */
export async function triggerRouteUpdateWebhook(
  route: Partial<ServiceRoute>,
  action: "created" | "started" | "stop_completed" | "route_completed"
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.ROUTE_UPDATE, {
      action: `route_${action}`,
      timestamp: new Date().toISOString(),
      data: {
        routeId: route.id,
        date: route.date,
        driverName: route.assignedDriver?.name,
        totalStops: route.complexes?.length,
        totalUnits: route.totalUnitsServiced,
        status: route.status,
        stops: route.complexes?.map((stop) => ({
          complexName: stop.complexName,
          unitsServiced: stop.unitsCompleted,
          skipped: stop.skipReasons?.length || 0,
          status: stop.status,
        })),
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Route update webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 6: COMPLAINT MANAGEMENT WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerComplaintWebhook — Fires when a complaint is received or resolved.
 *
 * MAKE.COM SCENARIO:
 * 1. Logs complaint in "Complaints" Google Sheet tab
 * 2. If urgent: sends immediate SMS to Domonique
 * 3. If cancellation threat: triggers Retention Agent
 * 4. Creates follow-up task for Complaint Resolution Agent (24hr)
 * 5. Updates client health score in CRM
 */
export async function triggerComplaintWebhook(
  complexId: string,
  complexName: string,
  complaintData: {
    type: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    affectedUnits?: string[];
    reportedBy: string;
  }
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.COMPLAINT_FILED, {
      action: "complaint_filed",
      timestamp: new Date().toISOString(),
      data: {
        complexId,
        complexName,
        ...complaintData,
      },
    });

    return { success: true, ticketId: response.data?.ticketId };
  } catch (error: any) {
    console.error("[MAKE] Complaint webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 7: FINANCIAL WEBHOOKS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerInvoiceWebhook — Fires when invoices are generated or paid.
 *
 * MAKE.COM SCENARIO:
 * 1. Generates invoice in Google Sheets "Invoices" tab
 * 2. Creates PDF invoice from template
 * 3. Sends invoice via email to billing contact
 * 4. If overdue (past due date): triggers Retention Agent reminder
 * 5. Updates revenue metrics in "Dashboard" sheet
 */
export async function triggerInvoiceWebhook(
  invoice: Partial<Invoice>,
  action: "generated" | "sent" | "paid" | "overdue"
) {
  try {
    const response = await axios.post(API.MAKE_WEBHOOKS.INVOICE_GENERATED, {
      action: `invoice_${action}`,
      timestamp: new Date().toISOString(),
      data: invoice,
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[MAKE] Invoice webhook failed:", error.message);
    return { success: false, error: error.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DAILY REPORTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerDailyReportWebhook — Fires at end of each business day.
 *
 * MAKE.COM SCENARIO:
 * 1. Aggregates all day's call data from "Call Log" sheet
 * 2. Compiles route completion stats
 * 3. Calculates revenue metrics
 * 4. Generates formatted daily report
 * 5. Sends to Domonique via email and Slack
 * 6. Updates "Daily Reports" sheet with historical tracking
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
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate monthly rate based on unit count and pricing tier.
 * Quiet Hours Valet pricing structure:
 * - Standard: $25/unit/month (basic pickup, 5 nights/week)
 * - Premium: $30/unit/month (pickup + recycling, 6 nights/week)
 * - Enterprise: $35/unit/month (all services, 7 nights/week, dedicated driver)
 *
 * Volume discounts:
 * - 200+ units: 5% discount
 * - 400+ units: 10% discount
 * - 600+ units: 15% discount
 */
function calculateMonthlyRate(
  units: number,
  tier: "standard" | "premium" | "enterprise"
): number {
  const baseRates = { standard: 25, premium: 30, enterprise: 35 };
  const baseRate = baseRates[tier];

  let discount = 0;
  if (units >= 600) discount = 0.15;
  else if (units >= 400) discount = 0.1;
  else if (units >= 200) discount = 0.05;

  const effectiveRate = baseRate * (1 - discount);
  return Math.round(units * effectiveRate * 100) / 100;
}

/**
 * Recommend a service schedule based on unit count.
 */
function recommendSchedule(units: number): {
  daysPerWeek: number;
  suggestedDays: string[];
} {
  if (units >= 400) {
    return {
      daysPerWeek: 7,
      suggestedDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };
  } else if (units >= 200) {
    return {
      daysPerWeek: 6,
      suggestedDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    };
  } else {
    return {
      daysPerWeek: 5,
      suggestedDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    };
  }
}
