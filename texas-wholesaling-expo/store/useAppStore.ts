// store/useAppStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS VALET — Global State Management (Zustand)
// Single store managing all app state: auth, agents, clients, routes,
// pipeline, notifications, and UI state. Uses Zustand for lightweight,
// performant state management with no boilerplate.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  User,
  AIAgent,
  ApartmentComplex,
  ServiceRoute,
  PipelineLead,
  CallLog,
  AppNotification,
  DashboardStats,
  RevenueMetrics,
  Invoice,
} from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ══════════════════════════════════════════════════════════════════════════════

interface AppState {
  // ── Authentication ──────────────────────────────────────────────────────
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;

  // ── AI Agents ───────────────────────────────────────────────────────────
  agents: AIAgent[];
  selectedAgent: AIAgent | null;
  setAgents: (agents: AIAgent[]) => void;
  updateAgent: (agentId: string, updates: Partial<AIAgent>) => void;
  setSelectedAgent: (agent: AIAgent | null) => void;
  toggleAgentStatus: (agentId: string) => void;

  // ── Clients / Apartment Complexes ───────────────────────────────────────
  clients: ApartmentComplex[];
  selectedClient: ApartmentComplex | null;
  setClients: (clients: ApartmentComplex[]) => void;
  addClient: (client: ApartmentComplex) => void;
  updateClient: (clientId: string, updates: Partial<ApartmentComplex>) => void;
  setSelectedClient: (client: ApartmentComplex | null) => void;

  // ── Service Routes ──────────────────────────────────────────────────────
  routes: ServiceRoute[];
  activeRoute: ServiceRoute | null;
  setRoutes: (routes: ServiceRoute[]) => void;
  setActiveRoute: (route: ServiceRoute | null) => void;
  updateRouteStop: (routeId: string, stopOrder: number, updates: any) => void;

  // ── Pipeline / CRM ──────────────────────────────────────────────────────
  pipeline: PipelineLead[];
  selectedLead: PipelineLead | null;
  setPipeline: (leads: PipelineLead[]) => void;
  addLead: (lead: PipelineLead) => void;
  updateLead: (leadId: string, updates: Partial<PipelineLead>) => void;
  setSelectedLead: (lead: PipelineLead | null) => void;
  moveLeadStage: (leadId: string, newStage: PipelineLead["stage"]) => void;

  // ── Call Logs ───────────────────────────────────────────────────────────
  callLogs: CallLog[];
  liveCall: CallLog | null;
  setCallLogs: (logs: CallLog[]) => void;
  addCallLog: (log: CallLog) => void;
  setLiveCall: (call: CallLog | null) => void;

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AppNotification) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;

  // ── Dashboard & Financials ──────────────────────────────────────────────
  dashboardStats: DashboardStats | null;
  revenueMetrics: RevenueMetrics | null;
  invoices: Invoice[];
  setDashboardStats: (stats: DashboardStats) => void;
  setRevenueMetrics: (metrics: RevenueMetrics) => void;
  setInvoices: (invoices: Invoice[]) => void;

  // ── UI State ────────────────────────────────────────────────────────────
  isRefreshing: boolean;
  activeTab: string;
  setRefreshing: (refreshing: boolean) => void;
  setActiveTab: (tab: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════════

export const useAppStore = create<AppState>((set, get) => ({
  // ── Authentication ──────────────────────────────────────────────────────
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),

  // ── AI Agents ───────────────────────────────────────────────────────────
  agents: [],
  selectedAgent: null,
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, ...updates } : a
      ),
      selectedAgent:
        state.selectedAgent?.id === agentId
          ? { ...state.selectedAgent, ...updates }
          : state.selectedAgent,
    })),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  toggleAgentStatus: (agentId) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, status: a.status === "disabled" ? "idle" : "disabled" }
          : a
      ),
    })),

  // ── Clients ─────────────────────────────────────────────────────────────
  clients: [],
  selectedClient: null,
  setClients: (clients) => set({ clients }),
  addClient: (client) =>
    set((state) => ({ clients: [...state.clients, client] })),
  updateClient: (clientId, updates) =>
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === clientId ? { ...c, ...updates } : c
      ),
    })),
  setSelectedClient: (selectedClient) => set({ selectedClient }),

  // ── Routes ──────────────────────────────────────────────────────────────
  routes: [],
  activeRoute: null,
  setRoutes: (routes) => set({ routes }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  updateRouteStop: (routeId, stopOrder, updates) =>
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              complexes: r.complexes.map((s) =>
                s.order === stopOrder ? { ...s, ...updates } : s
              ),
            }
          : r
      ),
    })),

  // ── Pipeline ────────────────────────────────────────────────────────────
  pipeline: [],
  selectedLead: null,
  setPipeline: (pipeline) => set({ pipeline }),
  addLead: (lead) =>
    set((state) => ({ pipeline: [...state.pipeline, lead] })),
  updateLead: (leadId, updates) =>
    set((state) => ({
      pipeline: state.pipeline.map((l) =>
        l.id === leadId ? { ...l, ...updates } : l
      ),
    })),
  setSelectedLead: (selectedLead) => set({ selectedLead }),
  moveLeadStage: (leadId, newStage) =>
    set((state) => ({
      pipeline: state.pipeline.map((l) =>
        l.id === leadId ? { ...l, stage: newStage, updatedAt: new Date().toISOString() } : l
      ),
    })),

  // ── Call Logs ───────────────────────────────────────────────────────────
  callLogs: [],
  liveCall: null,
  setCallLogs: (callLogs) => set({ callLogs }),
  addCallLog: (log) =>
    set((state) => ({ callLogs: [log, ...state.callLogs] })),
  setLiveCall: (liveCall) => set({ liveCall }),

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  // ── Dashboard & Financials ──────────────────────────────────────────────
  dashboardStats: null,
  revenueMetrics: null,
  invoices: [],
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setRevenueMetrics: (revenueMetrics) => set({ revenueMetrics }),
  setInvoices: (invoices) => set({ invoices }),

  // ── UI State ────────────────────────────────────────────────────────────
  isRefreshing: false,
  activeTab: "dashboard",
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
