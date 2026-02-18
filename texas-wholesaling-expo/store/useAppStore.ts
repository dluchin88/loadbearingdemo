// store/useAppStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// TEXAS WHOLESALING — Global State Management (Zustand)
//
// Single store managing all app state for the wholesaling operation:
// - Auth (Domonique as owner)
// - 11 AI Agents (Zara + 8 Cold Callers + Luna + Blaze)
// - Leads pipeline (raw → warm → hot → deal)
// - Deals (under contract, in disposition, closed)
// - Cash Buyers list
// - Call logs
// - Notifications
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  AIAgent,
  AgentRole,
  AgentStatus,
  CallLog,
} from "../services/agents/vapiService";
import type {
  Lead,
  Deal,
  Buyer,
  DashboardStats,
} from "../services/api/supabaseService";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "owner" | "admin" | "viewer";
  preferences: {
    theme: "dark" | "light";
    notificationsEnabled: boolean;
    dailySummaryTime: string;
  };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: "low" | "medium" | "high" | "urgent";
  read: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

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

  // ── AI Agents (11 total) ────────────────────────────────────────────────
  agents: AIAgent[];
  selectedAgent: AIAgent | null;
  setAgents: (agents: AIAgent[]) => void;
  updateAgent: (agentId: string, updates: Partial<AIAgent>) => void;
  setSelectedAgent: (agent: AIAgent | null) => void;
  toggleAgentStatus: (agentId: string) => void;
  getAgentsByRole: (role: AgentRole) => AIAgent[];
  getColdCallers: () => AIAgent[];

  // ── Leads Pipeline ──────────────────────────────────────────────────────
  leads: Lead[];
  selectedLead: Lead | null;
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (leadId: string, updates: Partial<Lead>) => void;
  setSelectedLead: (lead: Lead | null) => void;
  getLeadsByStage: (stage: string) => Lead[];
  getLeadsByCounty: (county: string) => Lead[];
  getHotLeads: () => Lead[];

  // ── Deals ───────────────────────────────────────────────────────────────
  deals: Deal[];
  selectedDeal: Deal | null;
  setDeals: (deals: Deal[]) => void;
  addDeal: (deal: Deal) => void;
  updateDeal: (dealId: string, updates: Partial<Deal>) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  getActiveDeals: () => Deal[];
  getPipelineValue: () => number;

  // ── Cash Buyers ─────────────────────────────────────────────────────────
  buyers: Buyer[];
  selectedBuyer: Buyer | null;
  setBuyers: (buyers: Buyer[]) => void;
  addBuyer: (buyer: Buyer) => void;
  updateBuyer: (buyerId: string, updates: Partial<Buyer>) => void;
  setSelectedBuyer: (buyer: Buyer | null) => void;
  getActiveBuyers: () => Buyer[];

  // ── Call Logs ───────────────────────────────────────────────────────────
  callLogs: CallLog[];
  liveCall: CallLog | null;
  setCallLogs: (logs: CallLog[]) => void;
  addCallLog: (log: CallLog) => void;
  setLiveCall: (call: CallLog | null) => void;
  getTodaysCalls: () => CallLog[];
  getCallsByAgent: (agentId: string) => CallLog[];

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AppNotification) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;

  // ── Dashboard Stats ─────────────────────────────────────────────────────
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats) => void;

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
  getAgentsByRole: (role) => get().agents.filter((a) => a.role === role),
  getColdCallers: () => get().agents.filter((a) => a.role === "cold_caller"),

  // ── Leads ───────────────────────────────────────────────────────────────
  leads: [],
  selectedLead: null,
  setLeads: (leads) => set({ leads }),
  addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
  updateLead: (leadId, updates) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, ...updates } : l
      ),
    })),
  setSelectedLead: (selectedLead) => set({ selectedLead }),
  getLeadsByStage: (stage) => get().leads.filter((l) => l.stage === stage),
  getLeadsByCounty: (county) =>
    get().leads.filter((l) => l.county.toLowerCase() === county.toLowerCase()),
  getHotLeads: () =>
    get().leads.filter((l) => l.motivation_score && l.motivation_score >= 7),

  // ── Deals ───────────────────────────────────────────────────────────────
  deals: [],
  selectedDeal: null,
  setDeals: (deals) => set({ deals }),
  addDeal: (deal) => set((state) => ({ deals: [...state.deals, deal] })),
  updateDeal: (dealId, updates) =>
    set((state) => ({
      deals: state.deals.map((d) =>
        d.id === dealId ? { ...d, ...updates } : d
      ),
    })),
  setSelectedDeal: (selectedDeal) => set({ selectedDeal }),
  getActiveDeals: () =>
    get().deals.filter(
      (d) => d.status === "under_contract" || d.status === "in_disposition"
    ),
  getPipelineValue: () =>
    get()
      .deals.filter((d) => d.status !== "closed" && d.status !== "dead")
      .reduce((sum, d) => sum + (d.assignment_fee || 0), 0),

  // ── Buyers ──────────────────────────────────────────────────────────────
  buyers: [],
  selectedBuyer: null,
  setBuyers: (buyers) => set({ buyers }),
  addBuyer: (buyer) => set((state) => ({ buyers: [...state.buyers, buyer] })),
  updateBuyer: (buyerId, updates) =>
    set((state) => ({
      buyers: state.buyers.map((b) =>
        b.id === buyerId ? { ...b, ...updates } : b
      ),
    })),
  setSelectedBuyer: (selectedBuyer) => set({ selectedBuyer }),
  getActiveBuyers: () => get().buyers.filter((b) => b.is_active),

  // ── Call Logs ───────────────────────────────────────────────────────────
  callLogs: [],
  liveCall: null,
  setCallLogs: (callLogs) => set({ callLogs }),
  addCallLog: (log) =>
    set((state) => ({ callLogs: [log, ...state.callLogs] })),
  setLiveCall: (liveCall) => set({ liveCall }),
  getTodaysCalls: () => {
    const today = new Date().toISOString().split("T")[0];
    return get().callLogs.filter((c) => c.startTime.startsWith(today));
  },
  getCallsByAgent: (agentId) =>
    get().callLogs.filter((c) => c.agentId === agentId),

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

  // ── Dashboard Stats ─────────────────────────────────────────────────────
  dashboardStats: null,
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),

  // ── UI State ────────────────────────────────────────────────────────────
  isRefreshing: false,
  activeTab: "dashboard",
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
