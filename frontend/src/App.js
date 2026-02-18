import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { 
  Phone, Users, Home, DollarSign, TrendingUp, Clock, 
  PhoneCall, UserCheck, Building2, Calculator, Menu, X,
  ChevronRight, BarChart3, Flame, Target, Zap
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Sidebar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "agents", label: "Agents", icon: Users },
    { id: "leads", label: "Leads", icon: Home },
    { id: "deals", label: "Deals", icon: DollarSign },
    { id: "buyers", label: "Buyers", icon: UserCheck },
    { id: "calls", label: "Call Log", icon: Phone },
    { id: "calculator", label: "Calculator", icon: Calculator },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-950/90 border-r border-zinc-800 z-50">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Texas Wholesaling</h1>
            <p className="text-xs text-zinc-500">Command Center</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "sidebar-active text-primary"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
            <img 
              src="https://ui-avatars.com/api/?name=Domonique&background=D4A017&color=000" 
              alt="Domonique" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-medium">Domonique</p>
            <p className="text-xs text-zinc-500">Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "primary" }) => {
  const colorClasses = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
    blue: "text-blue-500"
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-5 card-hover" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</p>
          <p className={`text-3xl font-bold mt-2 number ${colorClasses[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded ${color === "primary" ? "bg-primary/10" : `bg-${color}-500/10`}`}>
            <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-500">{trend}</span>
        </div>
      )}
    </div>
  );
};

const AgentCard = ({ agent }) => {
  const statusColors = {
    idle: "bg-emerald-500",
    on_call: "bg-violet-500 animate-pulse",
    cooldown: "bg-amber-500",
    disabled: "bg-zinc-500",
    error: "bg-red-500"
  };

  const roleLabels = {
    receptionist: "Receptionist",
    cold_caller: "Cold Caller",
    follow_up: "Follow-Up",
    disposition: "Disposition"
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-4 card-hover" data-testid={`agent-${agent.id}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800">
            {agent.avatar_url ? (
              <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-zinc-500">
                {agent.name[0]}
              </div>
            )}
          </div>
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${statusColors[agent.status]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{agent.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {roleLabels[agent.role]}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate">
            {agent.assigned_counties?.join(", ") || "All Counties"}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="bg-zinc-800/50 rounded py-2">
          <p className="text-lg font-bold number">{agent.calls_today}</p>
          <p className="text-xs text-zinc-500">Today</p>
        </div>
        <div className="bg-zinc-800/50 rounded py-2">
          <p className="text-lg font-bold number">{agent.total_calls}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
      </div>
      {agent.schedule && (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />
          {agent.schedule}
        </div>
      )}
    </div>
  );
};

const LeadRow = ({ lead, onClick }) => {
  const stageClasses = {
    raw: "bg-zinc-700 text-zinc-300",
    warm: "bg-amber-900/50 text-amber-400",
    hot: "bg-red-900/50 text-red-400",
    deal: "bg-emerald-900/50 text-emerald-400",
    dnc: "bg-zinc-800 text-zinc-500",
    dead: "bg-zinc-800 text-zinc-500"
  };

  const scoreColor = lead.motivation_score >= 7 ? "text-red-400" : lead.motivation_score >= 4 ? "text-amber-400" : "text-zinc-400";

  return (
    <tr 
      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
      onClick={() => onClick?.(lead)}
      data-testid={`lead-row-${lead.id}`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {lead.motivation_score >= 7 && <Flame className="w-4 h-4 text-red-500" />}
          <div>
            <p className="font-medium text-sm">{lead.owner_name}</p>
            <p className="text-xs text-zinc-500">{lead.phone_1}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm">{lead.property_address}</p>
        <p className="text-xs text-zinc-500">{lead.city}, {lead.county}</p>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${stageClasses[lead.stage]}`}>
          {lead.stage}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className={`font-bold number ${scoreColor}`}>{lead.motivation_score}/10</span>
      </td>
      <td className="py-3 px-4">
        {lead.asking_price ? (
          <span className="number text-primary">${lead.asking_price.toLocaleString()}</span>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-zinc-500">{lead.data_source?.replace(/_/g, " ")}</span>
      </td>
    </tr>
  );
};

const DealCard = ({ deal }) => {
  const statusColors = {
    under_contract: "text-blue-400 bg-blue-900/30",
    in_disposition: "text-amber-400 bg-amber-900/30",
    closing: "text-emerald-400 bg-emerald-900/30",
    closed: "text-emerald-500 bg-emerald-900/50",
    dead: "text-zinc-500 bg-zinc-800"
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-5 card-hover" data-testid={`deal-${deal.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold">{deal.property_address}</h3>
          <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${statusColors[deal.status]}`}>
            {deal.status?.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary number">${deal.assignment_fee?.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Assignment Fee</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-zinc-500 text-xs">ARV</p>
          <p className="font-semibold number">${deal.arv?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Contract Price</p>
          <p className="font-semibold number">${deal.contract_price?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Rehab Estimate</p>
          <p className="font-semibold number">${deal.rehab_estimate?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">Est. Profit</p>
          <p className="font-semibold text-emerald-400 number">${deal.profit_estimate?.toLocaleString()}</p>
        </div>
      </div>
      
      {deal.buyer_name && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">Assigned Buyer</p>
          <p className="font-medium">{deal.buyer_name}</p>
        </div>
      )}
    </div>
  );
};

const BuyerCard = ({ buyer }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 p-4 card-hover" data-testid={`buyer-${buyer.id}`}>
    <div className="flex items-start justify-between">
      <div>
        <h3 className="font-semibold">{buyer.name}</h3>
        {buyer.company && <p className="text-sm text-zinc-500">{buyer.company}</p>}
      </div>
      <div className="text-right">
        <p className="text-xl font-bold text-primary number">{buyer.deals_purchased}</p>
        <p className="text-xs text-zinc-500">Deals</p>
      </div>
    </div>
    <div className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-zinc-500">Max Price</span>
        <span className="number">${buyer.max_price?.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">Funding</span>
        <span className="capitalize">{buyer.cash_or_hard_money?.replace(/_/g, " ")}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">Rehab Tolerance</span>
        <span className="capitalize">{buyer.rehab_tolerance}</span>
      </div>
    </div>
    {buyer.preferred_areas?.length > 0 && (
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 mb-2">Preferred Areas</p>
        <div className="flex flex-wrap gap-1">
          {buyer.preferred_areas.map((area, i) => (
            <span key={i} className="text-xs px-2 py-1 bg-zinc-800 rounded">{area}</span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const MAOCalculator = () => {
  const [arv, setArv] = useState("");
  const [rehab, setRehab] = useState("");
  const [assignmentFee, setAssignmentFee] = useState("10000");
  const [result, setResult] = useState(null);

  const calculate = async () => {
    try {
      const response = await axios.post(`${API}/calculator/mao`, {
        arv: parseFloat(arv) || 0,
        rehab_estimate: parseFloat(rehab) || 0,
        assignment_fee: parseFloat(assignmentFee) || 10000
      });
      setResult(response.data);
    } catch (error) {
      console.error("Calculator error:", error);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6" data-testid="mao-calculator">
      <h2 className="text-xl font-bold mb-1">70% Rule Calculator</h2>
      <p className="text-sm text-zinc-500 mb-6">MAO = (ARV × 0.70) - Repairs - Assignment Fee</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">After Repair Value (ARV)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              value={arv}
              onChange={(e) => setArv(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-8 py-3 text-lg number focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="200,000"
              data-testid="arv-input"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Rehab Estimate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              value={rehab}
              onChange={(e) => setRehab(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-8 py-3 text-lg number focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="35,000"
              data-testid="rehab-input"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Assignment Fee</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              value={assignmentFee}
              onChange={(e) => setAssignmentFee(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-8 py-3 text-lg number focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="10,000"
              data-testid="fee-input"
            />
          </div>
        </div>
        
        <button
          onClick={calculate}
          className="w-full bg-primary text-primary-foreground font-semibold py-3 hover:bg-primary/90 transition-colors"
          data-testid="calculate-btn"
        >
          Calculate MAO
        </button>
      </div>
      
      {result && (
        <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500">Maximum Allowable Offer</p>
            <p className="text-4xl font-bold text-primary number">${result.max_allowable_offer?.toLocaleString()}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-zinc-800/50 rounded p-3">
              <p className="text-zinc-500">70% of ARV</p>
              <p className="font-semibold number">${result.seventy_percent_arv?.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-800/50 rounded p-3">
              <p className="text-zinc-500">Profit at MAO</p>
              <p className="font-semibold text-emerald-400 number">${result.profit_at_mao?.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardPage = ({ stats, agents, leads, deals }) => {
  const hotLeads = leads?.filter(l => l.motivation_score >= 7) || [];
  const activeDeals = deals?.filter(d => d.status !== "closed" && d.status !== "dead") || [];
  const onCallAgents = agents?.filter(a => a.status === "on_call") || [];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Pipeline Value" 
          value={`$${(stats?.pipeline_value || 0).toLocaleString()}`}
          subtitle={`${activeDeals.length} active deals`}
          icon={DollarSign}
          color="primary"
        />
        <StatCard 
          title="Hot Leads" 
          value={stats?.hot_leads || 0}
          subtitle="Motivation 7+"
          icon={Flame}
          color="red"
        />
        <StatCard 
          title="Calls Today" 
          value={stats?.calls_today || 0}
          subtitle={`${onCallAgents.length} agents on call`}
          icon={Phone}
          color="emerald"
        />
        <StatCard 
          title="Active Buyers" 
          value={stats?.active_buyers || 0}
          subtitle="Ready to close"
          icon={UserCheck}
          color="blue"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Status */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Agent Status</h2>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Idle
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span> On Call
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {agents?.slice(0, 8).map(agent => (
              <div key={agent.id} className="flex items-center gap-2 bg-zinc-800/50 rounded p-2">
                <div className={`w-2 h-2 rounded-full ${agent.status === "on_call" ? "bg-violet-500 animate-pulse" : "bg-emerald-500"}`} />
                <span className="text-sm font-medium truncate">{agent.name}</span>
                <span className="text-xs text-zinc-500 ml-auto number">{agent.calls_today}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Leads Alert */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold">Hot Leads</h2>
          </div>
          <div className="space-y-3">
            {hotLeads.length > 0 ? hotLeads.slice(0, 5).map(lead => (
              <div key={lead.id} className="flex items-center justify-between bg-zinc-800/50 rounded p-3">
                <div>
                  <p className="font-medium text-sm">{lead.owner_name}</p>
                  <p className="text-xs text-zinc-500">{lead.county} County</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-400">{lead.motivation_score}/10</p>
                  {lead.asking_price && (
                    <p className="text-xs text-primary number">${lead.asking_price.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-zinc-500 text-sm">No hot leads yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Active Deals */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-5">
        <h2 className="text-lg font-bold mb-4">Active Deals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeDeals.length > 0 ? activeDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          )) : (
            <p className="text-zinc-500">No active deals</p>
          )}
        </div>
      </div>

      {/* Lead Pipeline by Stage */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-5">
        <h2 className="text-lg font-bold mb-4">Pipeline Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          {["raw", "warm", "hot", "deal"].map(stage => {
            const count = stats?.leads_by_stage?.[stage] || 0;
            const colors = {
              raw: "border-zinc-600",
              warm: "border-amber-500",
              hot: "border-red-500",
              deal: "border-emerald-500"
            };
            return (
              <div key={stage} className={`border-l-4 ${colors[stage]} bg-zinc-800/30 p-4`}>
                <p className="text-2xl font-bold number">{count}</p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">{stage}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AgentsPage = ({ agents }) => (
  <div className="space-y-6" data-testid="agents-page">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">AI Agents</h1>
      <p className="text-sm text-zinc-500">11 agents • 14 counties • 320 calls/day</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents?.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  </div>
);

const LeadsPage = ({ leads }) => (
  <div className="space-y-6" data-testid="leads-page">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Leads Pipeline</h1>
      <p className="text-sm text-zinc-500">{leads?.length || 0} total leads</p>
    </div>
    
    <div className="bg-zinc-900/50 border border-zinc-800 overflow-hidden">
      <table className="w-full data-table">
        <thead className="bg-zinc-800/50">
          <tr>
            <th className="text-left py-3 px-4">Contact</th>
            <th className="text-left py-3 px-4">Property</th>
            <th className="text-left py-3 px-4">Stage</th>
            <th className="text-left py-3 px-4">Score</th>
            <th className="text-left py-3 px-4">Asking</th>
            <th className="text-left py-3 px-4">Source</th>
          </tr>
        </thead>
        <tbody>
          {leads?.length > 0 ? leads.map(lead => (
            <LeadRow key={lead.id} lead={lead} />
          )) : (
            <tr>
              <td colSpan={6} className="py-8 text-center text-zinc-500">No leads found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const DealsPage = ({ deals }) => (
  <div className="space-y-6" data-testid="deals-page">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Deals</h1>
      <p className="text-sm text-zinc-500">{deals?.length || 0} total deals</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {deals?.length > 0 ? deals.map(deal => (
        <DealCard key={deal.id} deal={deal} />
      )) : (
        <p className="text-zinc-500 col-span-3 text-center py-8">No deals yet</p>
      )}
    </div>
  </div>
);

const BuyersPage = ({ buyers }) => (
  <div className="space-y-6" data-testid="buyers-page">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Cash Buyers</h1>
      <p className="text-sm text-zinc-500">{buyers?.length || 0} active buyers</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {buyers?.length > 0 ? buyers.map(buyer => (
        <BuyerCard key={buyer.id} buyer={buyer} />
      )) : (
        <p className="text-zinc-500 col-span-3 text-center py-8">No buyers yet</p>
      )}
    </div>
  </div>
);

const CallsPage = ({ calls }) => (
  <div className="space-y-6" data-testid="calls-page">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Call Log</h1>
      <p className="text-sm text-zinc-500">{calls?.length || 0} calls</p>
    </div>
    
    <div className="bg-zinc-900/50 border border-zinc-800 overflow-hidden">
      <table className="w-full data-table">
        <thead className="bg-zinc-800/50">
          <tr>
            <th className="text-left py-3 px-4">Agent</th>
            <th className="text-left py-3 px-4">Contact</th>
            <th className="text-left py-3 px-4">Property</th>
            <th className="text-left py-3 px-4">Duration</th>
            <th className="text-left py-3 px-4">Outcome</th>
            <th className="text-left py-3 px-4">Score</th>
          </tr>
        </thead>
        <tbody>
          {calls?.length > 0 ? calls.map(call => (
            <tr key={call.id} className="border-b border-zinc-800/50">
              <td className="py-3 px-4 font-medium">{call.agent_name}</td>
              <td className="py-3 px-4">
                <p className="text-sm">{call.contact_name || "Unknown"}</p>
                <p className="text-xs text-zinc-500">{call.contact_phone}</p>
              </td>
              <td className="py-3 px-4 text-sm">{call.property_address || "—"}</td>
              <td className="py-3 px-4 number">{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, "0")}</td>
              <td className="py-3 px-4">
                <span className="text-xs px-2 py-1 rounded bg-zinc-800 capitalize">
                  {call.outcome?.replace(/_/g, " ")}
                </span>
              </td>
              <td className="py-3 px-4">
                {call.motivation_score ? (
                  <span className={`font-bold ${call.motivation_score >= 7 ? "text-red-400" : call.motivation_score >= 4 ? "text-amber-400" : "text-zinc-400"}`}>
                    {call.motivation_score}/10
                  </span>
                ) : "—"}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={6} className="py-8 text-center text-zinc-500">No calls logged yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const CalculatorPage = () => (
  <div className="space-y-6" data-testid="calculator-page">
    <h1 className="text-2xl font-bold">Deal Calculator</h1>
    <div className="max-w-lg">
      <MAOCalculator />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Seed data first
      await axios.post(`${API}/seed`);
      
      const [statsRes, agentsRes, leadsRes, dealsRes, buyersRes, callsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/agents`),
        axios.get(`${API}/leads`),
        axios.get(`${API}/deals`),
        axios.get(`${API}/buyers`),
        axios.get(`${API}/calls`)
      ]);
      
      setStats(statsRes.data);
      setAgents(agentsRes.data);
      setLeads(leadsRes.data);
      setDeals(dealsRes.data);
      setBuyers(buyersRes.data);
      setCalls(callsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage stats={stats} agents={agents} leads={leads} deals={deals} />;
      case "agents":
        return <AgentsPage agents={agents} />;
      case "leads":
        return <LeadsPage leads={leads} />;
      case "deals":
        return <DealsPage deals={deals} />;
      case "buyers":
        return <BuyersPage buyers={buyers} />;
      case "calls":
        return <CallsPage calls={calls} />;
      case "calculator":
        return <CalculatorPage />;
      default:
        return <DashboardPage stats={stats} agents={agents} leads={leads} deals={deals} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="ml-64 p-6">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
