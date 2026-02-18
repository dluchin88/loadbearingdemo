// services/api/googleSheetsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Google Sheets CRM Integration
//
// Google Sheets serves as the lightweight CRM/database for the business.
// Data is accessed via a Google Apps Script web app deployed as an API.
// This service handles all CRUD operations against the Sheets backend.
//
// SHEET STRUCTURE:
// ┌─────────────────────────────────────────────────────────────────┐
// │ Quiet Hours Valet Master Spreadsheet                           │
// ├─────────────────┬───────────────────────────────────────────────┤
// │ Tab Name        │ Purpose                                      │
// ├─────────────────┼───────────────────────────────────────────────┤
// │ Prospects       │ All leads from Prospector Agent               │
// │ Active Clients  │ Signed clients with service details           │
// │ Call Log        │ Every call made by every agent                │
// │ Routes          │ Nightly route plans and completion data        │
// │ Invoices        │ Billing records and payment tracking           │
// │ Complaints      │ Service issues and resolution tracking         │
// │ Agent Metrics   │ Daily performance stats per agent              │
// │ Dashboard       │ Aggregated KPIs updated in real-time           │
// │ Daily Reports   │ Historical daily summaries                     │
// └─────────────────┴───────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { API } from "../../constants";
import type {
  PipelineLead,
  ApartmentComplex,
  CallLog,
  DashboardStats,
  RevenueMetrics,
} from "../../types";

// ══════════════════════════════════════════════════════════════════════════════
// PROSPECT / LEAD OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all prospects from the Prospects sheet.
 * Supports filtering by stage, score range, and date range.
 */
export async function getProspects(filters?: {
  stage?: string;
  minScore?: number;
  maxScore?: number;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<PipelineLead[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.PROSPECTS_SHEET, {
      params: {
        action: "getAll",
        ...filters,
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch prospects:", error.message);
    return [];
  }
}

/**
 * Update a prospect's pipeline stage and add notes.
 * Called when AI agents advance leads through the funnel.
 */
export async function updateProspectStage(
  leadId: string,
  newStage: string,
  notes?: string
): Promise<boolean> {
  try {
    await axios.post(API.GOOGLE_SHEETS.PROSPECTS_SHEET, {
      action: "updateStage",
      leadId,
      stage: newStage,
      notes,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error: any) {
    console.error("[SHEETS] Failed to update prospect stage:", error.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all active clients from the Active Clients sheet.
 */
export async function getActiveClients(): Promise<ApartmentComplex[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CLIENTS_SHEET, {
      params: { action: "getAll", status: "active" },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch clients:", error.message);
    return [];
  }
}

/**
 * Get a single client's complete record.
 */
export async function getClientById(
  clientId: string
): Promise<ApartmentComplex | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CLIENTS_SHEET, {
      params: { action: "getById", id: clientId },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch client:", error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALL LOG OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch call logs with optional filtering by agent, date, or outcome.
 */
export async function getCallLogs(filters?: {
  agentRole?: string;
  dateFrom?: string;
  dateTo?: string;
  outcome?: string;
  limit?: number;
}): Promise<CallLog[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CALL_LOG_SHEET, {
      params: {
        action: "getAll",
        ...filters,
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch call logs:", error.message);
    return [];
  }
}

/**
 * Get today's call summary grouped by agent.
 */
export async function getTodaysCallSummary(): Promise<
  Record<string, { total: number; successful: number; avgDuration: number }>
> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await axios.get(API.GOOGLE_SHEETS.CALL_LOG_SHEET, {
      params: { action: "dailySummary", date: today },
    });
    return response.data?.data || {};
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch call summary:", error.message);
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD & METRICS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch aggregated dashboard statistics.
 * This pulls from the "Dashboard" tab which is auto-updated by Make.com.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.CLIENTS_SHEET, {
      params: { action: "getDashboardStats" },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch dashboard stats:", error.message);
    return null;
  }
}

/**
 * Fetch detailed revenue metrics for the financials view.
 */
export async function getRevenueMetrics(): Promise<RevenueMetrics | null> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.FINANCIALS_SHEET, {
      params: { action: "getRevenueMetrics" },
    });
    return response.data?.data || null;
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch revenue metrics:", error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch tonight's planned routes.
 */
export async function getTonightsRoutes(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await axios.get(API.GOOGLE_SHEETS.ROUTES_SHEET, {
      params: { action: "getByDate", date: today },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch routes:", error.message);
    return [];
  }
}

/**
 * Get route completion history for the past N days.
 * Powers the route performance charts on the dashboard.
 */
export async function getRouteHistory(days: number = 30): Promise<any[]> {
  try {
    const response = await axios.get(API.GOOGLE_SHEETS.ROUTES_SHEET, {
      params: { action: "getHistory", days },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("[SHEETS] Failed to fetch route history:", error.message);
    return [];
  }
}
