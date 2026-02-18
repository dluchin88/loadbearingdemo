from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class AgentRole(str, Enum):
    RECEPTIONIST = "receptionist"
    COLD_CALLER = "cold_caller"
    FOLLOW_UP = "follow_up"
    DISPOSITION = "disposition"

class AgentStatus(str, Enum):
    IDLE = "idle"
    ON_CALL = "on_call"
    COOLDOWN = "cooldown"
    DISABLED = "disabled"
    ERROR = "error"

class LeadStage(str, Enum):
    RAW = "raw"
    WARM = "warm"
    HOT = "hot"
    DEAL = "deal"
    DNC = "dnc"
    DEAD = "dead"

class DealStatus(str, Enum):
    UNDER_CONTRACT = "under_contract"
    IN_DISPOSITION = "in_disposition"
    CLOSING = "closing"
    CLOSED = "closed"
    DEAD = "dead"

# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: AgentRole
    status: AgentStatus = AgentStatus.IDLE
    assigned_counties: List[str] = []
    schedule: Optional[str] = None
    daily_call_limit: int = 40
    calls_today: int = 0
    total_calls: int = 0
    avatar_url: Optional[str] = None
    voice_id: Optional[str] = None

class AgentUpdate(BaseModel):
    status: Optional[AgentStatus] = None
    calls_today: Optional[int] = None

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_address: str
    city: str
    county: str
    zip_code: str
    owner_name: str
    phone_1: str
    phone_2: Optional[str] = None
    phone_3: Optional[str] = None
    data_source: str
    motivation_score: int = 0
    asking_price: Optional[float] = None
    property_type: str = "single_family"
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    condition: str = "unknown"
    is_vacant: bool = False
    has_mortgage: bool = True
    mortgage_balance: Optional[float] = None
    stage: LeadStage = LeadStage.RAW
    assigned_agent: Optional[str] = None
    do_not_call: bool = False
    total_attempts: int = 0
    last_called_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LeadCreate(BaseModel):
    property_address: str
    city: str
    county: str
    zip_code: str
    owner_name: str
    phone_1: str
    phone_2: Optional[str] = None
    phone_3: Optional[str] = None
    data_source: str
    motivation_score: int = 0
    asking_price: Optional[float] = None
    property_type: str = "single_family"
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    condition: str = "unknown"
    is_vacant: bool = False
    notes: Optional[str] = None

class LeadUpdate(BaseModel):
    stage: Optional[LeadStage] = None
    motivation_score: Optional[int] = None
    asking_price: Optional[float] = None
    assigned_agent: Optional[str] = None
    do_not_call: Optional[bool] = None
    notes: Optional[str] = None
    total_attempts: Optional[int] = None
    last_called_at: Optional[str] = None

class Deal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    property_address: str
    arv: float
    rehab_estimate: float
    contract_price: float
    assignment_fee: float = 10000
    max_allowable_offer: float = 0
    profit_estimate: float = 0
    status: DealStatus = DealStatus.UNDER_CONTRACT
    contract_signed_date: Optional[str] = None
    closing_date: Optional[str] = None
    buyer_id: Optional[str] = None
    buyer_name: Optional[str] = None
    title_company: Optional[str] = None
    earnest_money: float = 0
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DealCreate(BaseModel):
    lead_id: str
    property_address: str
    arv: float
    rehab_estimate: float
    contract_price: float
    assignment_fee: float = 10000
    contract_signed_date: Optional[str] = None
    closing_date: Optional[str] = None
    title_company: Optional[str] = None
    earnest_money: float = 0
    notes: Optional[str] = None

class DealUpdate(BaseModel):
    status: Optional[DealStatus] = None
    buyer_id: Optional[str] = None
    buyer_name: Optional[str] = None
    closing_date: Optional[str] = None
    notes: Optional[str] = None

class Buyer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = None
    phone: str
    email: Optional[str] = None
    preferred_areas: List[str] = []
    max_price: float = 500000
    min_price: float = 0
    rehab_tolerance: str = "moderate"
    cash_or_hard_money: str = "cash"
    deals_purchased: int = 0
    last_deal_date: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BuyerCreate(BaseModel):
    name: str
    company: Optional[str] = None
    phone: str
    email: Optional[str] = None
    preferred_areas: List[str] = []
    max_price: float = 500000
    min_price: float = 0
    rehab_tolerance: str = "moderate"
    cash_or_hard_money: str = "cash"
    notes: Optional[str] = None

class CallLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    agent_name: str
    direction: str = "outbound"
    contact_phone: str
    contact_name: Optional[str] = None
    lead_id: Optional[str] = None
    property_address: Optional[str] = None
    county: Optional[str] = None
    duration: int = 0
    outcome: str = "no_answer"
    motivation_score: Optional[int] = None
    transcript_summary: Optional[str] = None
    recording_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CallLogCreate(BaseModel):
    agent_id: str
    agent_name: str
    direction: str = "outbound"
    contact_phone: str
    contact_name: Optional[str] = None
    lead_id: Optional[str] = None
    property_address: Optional[str] = None
    county: Optional[str] = None
    duration: int = 0
    outcome: str = "no_answer"
    motivation_score: Optional[int] = None
    transcript_summary: Optional[str] = None

# ═══════════════════════════════════════════════════════════════════════════════
# SEED DATA
# ═══════════════════════════════════════════════════════════════════════════════

AGENTS_SEED = [
    {"id": "zara_tw", "name": "Zara", "role": "receptionist", "assigned_counties": ["All"], "schedule": "24/7", "daily_call_limit": 0, "avatar_url": "https://images.unsplash.com/photo-1771072426488-87e6bbcc0cf7?w=200"},
    {"id": "ace", "name": "Ace", "role": "cold_caller", "assigned_counties": ["Harris N", "Harris E"], "schedule": "9:00 AM - 11:30 AM", "avatar_url": "https://images.pexels.com/photos/34129724/pexels-photo-34129724.jpeg?w=200"},
    {"id": "maya", "name": "Maya", "role": "cold_caller", "assigned_counties": ["Harris S", "Harris W"], "schedule": "9:30 AM - 12:00 PM", "avatar_url": "https://images.unsplash.com/photo-1695996660160-366ff8d602c4?w=200"},
    {"id": "eli", "name": "Eli", "role": "cold_caller", "assigned_counties": ["Fort Bend", "Brazoria"], "schedule": "10:00 AM - 12:30 PM", "avatar_url": "https://images.pexels.com/photos/10402659/pexels-photo-10402659.jpeg?w=200"},
    {"id": "nova", "name": "Nova", "role": "cold_caller", "assigned_counties": ["Montgomery", "Walker"], "schedule": "10:30 AM - 1:00 PM", "avatar_url": "https://images.pexels.com/photos/33871730/pexels-photo-33871730.jpeg?w=200"},
    {"id": "raven", "name": "Raven", "role": "cold_caller", "assigned_counties": ["Galveston", "Chambers"], "schedule": "1:00 PM - 3:30 PM", "avatar_url": "https://images.unsplash.com/photo-1695048994291-2e96839a0a3a?w=200"},
    {"id": "jett", "name": "Jett", "role": "cold_caller", "assigned_counties": ["Liberty", "San Jacinto"], "schedule": "1:30 PM - 4:00 PM", "avatar_url": "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?w=200"},
    {"id": "sage", "name": "Sage", "role": "cold_caller", "assigned_counties": ["Waller", "Austin Co"], "schedule": "2:00 PM - 4:30 PM", "avatar_url": "https://images.pexels.com/photos/18153495/pexels-photo-18153495.jpeg?w=200"},
    {"id": "finn", "name": "Finn", "role": "cold_caller", "assigned_counties": ["Colorado", "Wharton", "Matagorda"], "schedule": "2:30 PM - 5:00 PM", "avatar_url": "https://images.unsplash.com/photo-1764698072732-ea0230fc5d8e?w=200"},
    {"id": "luna", "name": "Luna", "role": "follow_up", "assigned_counties": ["All"], "schedule": "10:00 AM - 2:00 PM", "daily_call_limit": 30, "avatar_url": "https://images.unsplash.com/photo-1771072428365-f0f97d0d25b7?w=200"},
    {"id": "blaze", "name": "Blaze", "role": "disposition", "assigned_counties": ["All"], "schedule": "9:00 AM - 5:00 PM", "daily_call_limit": 25, "avatar_url": "https://images.unsplash.com/photo-1764545973653-94c40d993495?w=200"},
]

COUNTIES = [
    "Harris", "Fort Bend", "Montgomery", "Brazoria", "Galveston",
    "Liberty", "Chambers", "Waller", "Austin", "Colorado",
    "Wharton", "Matagorda", "San Jacinto", "Walker"
]

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - ROOT
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/")
async def root():
    return {"message": "Texas Wholesaling Command Center API"}

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - AGENTS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/agents", response_model=List[Agent])
async def get_agents():
    agents = await db.agents.find({}, {"_id": 0}).to_list(100)
    if not agents:
        # Seed agents if empty
        for agent_data in AGENTS_SEED:
            agent = Agent(**agent_data)
            await db.agents.insert_one(agent.model_dump())
        agents = await db.agents.find({}, {"_id": 0}).to_list(100)
    return agents

@api_router.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@api_router.patch("/agents/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, update: AgentUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.agents.update_one({"id": agent_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return await db.agents.find_one({"id": agent_id}, {"_id": 0})

@api_router.post("/agents/{agent_id}/reset-daily")
async def reset_agent_daily_calls(agent_id: str):
    result = await db.agents.update_one({"id": agent_id}, {"$set": {"calls_today": 0}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Daily calls reset"}

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - LEADS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    stage: Optional[str] = None,
    county: Optional[str] = None,
    min_score: Optional[int] = None,
    limit: int = 100
):
    query = {"do_not_call": False}
    if stage:
        query["stage"] = stage
    if county:
        query["county"] = {"$regex": county, "$options": "i"}
    if min_score is not None:
        query["motivation_score"] = {"$gte": min_score}
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return leads

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    lead = Lead(**lead_data.model_dump())
    await db.leads.insert_one(lead.model_dump())
    return lead

@api_router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, update: LeadUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

@api_router.get("/leads/stats/by-stage")
async def get_leads_by_stage():
    pipeline = [
        {"$match": {"do_not_call": False}},
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]
    results = await db.leads.aggregate(pipeline).to_list(100)
    return {r["_id"]: r["count"] for r in results}

@api_router.get("/leads/stats/by-county")
async def get_leads_by_county():
    pipeline = [
        {"$match": {"do_not_call": False}},
        {"$group": {"_id": "$county", "count": {"$sum": 1}}}
    ]
    results = await db.leads.aggregate(pipeline).to_list(100)
    return {r["_id"]: r["count"] for r in results}

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - DEALS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/deals", response_model=List[Deal])
async def get_deals(status: Optional[str] = None, limit: int = 100):
    query = {}
    if status:
        query["status"] = status
    deals = await db.deals.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return deals

@api_router.get("/deals/{deal_id}", response_model=Deal)
async def get_deal(deal_id: str):
    deal = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

@api_router.post("/deals", response_model=Deal)
async def create_deal(deal_data: DealCreate):
    # Calculate MAO and profit
    mao = (deal_data.arv * 0.70) - deal_data.rehab_estimate - deal_data.assignment_fee
    profit = deal_data.arv - deal_data.contract_price - deal_data.rehab_estimate - deal_data.assignment_fee
    
    deal = Deal(
        **deal_data.model_dump(),
        max_allowable_offer=mao,
        profit_estimate=profit
    )
    await db.deals.insert_one(deal.model_dump())
    
    # Update lead stage to "deal"
    await db.leads.update_one({"id": deal_data.lead_id}, {"$set": {"stage": "deal"}})
    
    return deal

@api_router.patch("/deals/{deal_id}", response_model=Deal)
async def update_deal(deal_id: str, update: DealUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.deals.update_one({"id": deal_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return await db.deals.find_one({"id": deal_id}, {"_id": 0})

@api_router.get("/deals/stats/pipeline-value")
async def get_pipeline_value():
    pipeline = [
        {"$match": {"status": {"$nin": ["closed", "dead"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$assignment_fee"}}}
    ]
    results = await db.deals.aggregate(pipeline).to_list(1)
    return {"pipeline_value": results[0]["total"] if results else 0}

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - BUYERS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/buyers", response_model=List[Buyer])
async def get_buyers(active_only: bool = True, limit: int = 100):
    query = {"is_active": True} if active_only else {}
    buyers = await db.buyers.find(query, {"_id": 0}).sort("deals_purchased", -1).to_list(limit)
    return buyers

@api_router.get("/buyers/{buyer_id}", response_model=Buyer)
async def get_buyer(buyer_id: str):
    buyer = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return buyer

@api_router.post("/buyers", response_model=Buyer)
async def create_buyer(buyer_data: BuyerCreate):
    buyer = Buyer(**buyer_data.model_dump())
    await db.buyers.insert_one(buyer.model_dump())
    return buyer

@api_router.patch("/buyers/{buyer_id}", response_model=Buyer)
async def update_buyer(buyer_id: str, update: Dict[str, Any]):
    if not update:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.buyers.update_one({"id": buyer_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    return await db.buyers.find_one({"id": buyer_id}, {"_id": 0})

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - CALL LOGS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/calls", response_model=List[CallLog])
async def get_call_logs(
    agent_id: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 100
):
    query = {}
    if agent_id:
        query["agent_id"] = agent_id
    if outcome:
        query["outcome"] = outcome
    
    calls = await db.call_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return calls

@api_router.post("/calls", response_model=CallLog)
async def create_call_log(call_data: CallLogCreate):
    call = CallLog(**call_data.model_dump())
    await db.call_logs.insert_one(call.model_dump())
    
    # Update agent stats
    await db.agents.update_one(
        {"id": call_data.agent_id},
        {"$inc": {"calls_today": 1, "total_calls": 1}}
    )
    
    # Update lead if provided
    if call_data.lead_id:
        await db.leads.update_one(
            {"id": call_data.lead_id},
            {
                "$inc": {"total_attempts": 1},
                "$set": {"last_called_at": call.created_at}
            }
        )
        if call_data.motivation_score:
            await db.leads.update_one(
                {"id": call_data.lead_id},
                {"$set": {"motivation_score": call_data.motivation_score}}
            )
    
    return call

@api_router.get("/calls/stats/today")
async def get_todays_call_stats():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"created_at": {"$regex": f"^{today}"}}},
        {"$group": {
            "_id": "$agent_name",
            "total_calls": {"$sum": 1},
            "total_duration": {"$sum": "$duration"},
            "hot_leads": {"$sum": {"$cond": [{"$gte": ["$motivation_score", 7]}, 1, 0]}},
            "warm_leads": {"$sum": {"$cond": [{"$and": [{"$gte": ["$motivation_score", 4]}, {"$lt": ["$motivation_score", 7]}]}, 1, 0]}}
        }}
    ]
    results = await db.call_logs.aggregate(pipeline).to_list(100)
    return results

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - DASHBOARD STATS
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # Lead counts by stage
    lead_stages = await db.leads.aggregate([
        {"$match": {"do_not_call": False}},
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]).to_list(100)
    leads_by_stage = {r["_id"]: r["count"] for r in lead_stages}
    
    # Deal counts by status
    deal_statuses = await db.deals.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(100)
    deals_by_status = {r["_id"]: r["count"] for r in deal_statuses}
    
    # Pipeline value
    pipeline_value = await db.deals.aggregate([
        {"$match": {"status": {"$nin": ["closed", "dead"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$assignment_fee"}}}
    ]).to_list(1)
    
    # Today's calls
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    calls_today = await db.call_logs.count_documents({"created_at": {"$regex": f"^{today}"}})
    
    # Hot leads count
    hot_leads = await db.leads.count_documents({"motivation_score": {"$gte": 7}, "do_not_call": False})
    
    # Active buyers
    active_buyers = await db.buyers.count_documents({"is_active": True})
    
    return {
        "leads_by_stage": leads_by_stage,
        "deals_by_status": deals_by_status,
        "pipeline_value": pipeline_value[0]["total"] if pipeline_value else 0,
        "calls_today": calls_today,
        "hot_leads": hot_leads,
        "active_buyers": active_buyers,
        "total_leads": sum(leads_by_stage.values()) if leads_by_stage else 0,
        "total_deals": sum(deals_by_status.values()) if deals_by_status else 0
    }

@api_router.get("/dashboard/counties")
async def get_county_stats():
    pipeline = [
        {"$match": {"do_not_call": False}},
        {"$group": {
            "_id": "$county",
            "total": {"$sum": 1},
            "hot": {"$sum": {"$cond": [{"$gte": ["$motivation_score", 7]}, 1, 0]}},
            "warm": {"$sum": {"$cond": [{"$and": [{"$gte": ["$motivation_score", 4]}, {"$lt": ["$motivation_score", 7]}]}, 1, 0]}},
            "raw": {"$sum": {"$cond": [{"$lt": ["$motivation_score", 4]}, 1, 0]}}
        }}
    ]
    results = await db.leads.aggregate(pipeline).to_list(100)
    return results

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES - DEAL CALCULATOR
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.post("/calculator/mao")
async def calculate_mao(data: Dict[str, float]):
    arv = data.get("arv", 0)
    rehab = data.get("rehab_estimate", 0)
    assignment_fee = data.get("assignment_fee", 10000)
    
    mao = (arv * 0.70) - rehab - assignment_fee
    profit_at_mao = arv - mao - rehab - assignment_fee
    
    return {
        "arv": arv,
        "rehab_estimate": rehab,
        "assignment_fee": assignment_fee,
        "max_allowable_offer": round(mao, 2),
        "profit_at_mao": round(profit_at_mao, 2),
        "seventy_percent_arv": round(arv * 0.70, 2)
    }

# ═══════════════════════════════════════════════════════════════════════════════
# SEED TEST DATA
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.post("/seed")
async def seed_test_data():
    # Seed agents
    existing_agents = await db.agents.count_documents({})
    if existing_agents == 0:
        for agent_data in AGENTS_SEED:
            agent = Agent(**agent_data)
            await db.agents.insert_one(agent.model_dump())
    
    # Seed sample leads
    existing_leads = await db.leads.count_documents({})
    if existing_leads == 0:
        sample_leads = [
            {"property_address": "1234 Main St", "city": "Houston", "county": "Harris", "zip_code": "77001", "owner_name": "John Smith", "phone_1": "+17135551234", "data_source": "tax_delinquent", "motivation_score": 8, "asking_price": 95000, "stage": "hot"},
            {"property_address": "5678 Oak Ave", "city": "Sugar Land", "county": "Fort Bend", "zip_code": "77478", "owner_name": "Maria Garcia", "phone_1": "+12815552345", "data_source": "probate", "motivation_score": 6, "asking_price": 150000, "stage": "warm"},
            {"property_address": "9012 Pine Rd", "city": "Conroe", "county": "Montgomery", "zip_code": "77301", "owner_name": "Robert Johnson", "phone_1": "+19365553456", "data_source": "pre_foreclosure", "motivation_score": 9, "asking_price": 120000, "stage": "hot"},
            {"property_address": "3456 Elm St", "city": "Galveston", "county": "Galveston", "zip_code": "77550", "owner_name": "Lisa Williams", "phone_1": "+14095554567", "data_source": "absentee_owner", "motivation_score": 3, "stage": "raw"},
            {"property_address": "7890 Cedar Ln", "city": "Pearland", "county": "Brazoria", "zip_code": "77581", "owner_name": "Michael Brown", "phone_1": "+17135555678", "data_source": "tax_delinquent", "motivation_score": 5, "asking_price": 180000, "stage": "warm"},
        ]
        for lead_data in sample_leads:
            lead = Lead(**lead_data)
            await db.leads.insert_one(lead.model_dump())
    
    # Seed sample buyers
    existing_buyers = await db.buyers.count_documents({})
    if existing_buyers == 0:
        sample_buyers = [
            {"name": "David Chen", "company": "Chen Investments LLC", "phone": "+17135556789", "email": "david@cheninv.com", "preferred_areas": ["Harris", "Fort Bend"], "max_price": 300000, "cash_or_hard_money": "cash", "deals_purchased": 12},
            {"name": "Sarah Miller", "company": "Miller Properties", "phone": "+12815557890", "email": "sarah@millerprops.com", "preferred_areas": ["Montgomery", "Harris"], "max_price": 200000, "cash_or_hard_money": "hard_money", "deals_purchased": 5},
            {"name": "James Wilson", "phone": "+19365558901", "preferred_areas": ["Galveston", "Brazoria"], "max_price": 150000, "cash_or_hard_money": "cash", "deals_purchased": 8},
        ]
        for buyer_data in sample_buyers:
            buyer = Buyer(**buyer_data)
            await db.buyers.insert_one(buyer.model_dump())
    
    # Seed sample deal
    existing_deals = await db.deals.count_documents({})
    if existing_deals == 0:
        sample_deal = Deal(
            lead_id="sample_lead_1",
            property_address="1234 Main St, Houston TX",
            arv=180000,
            rehab_estimate=35000,
            contract_price=85000,
            assignment_fee=12000,
            max_allowable_offer=79000,
            profit_estimate=48000,
            status="in_disposition"
        )
        await db.deals.insert_one(sample_deal.model_dump())
    
    return {"message": "Test data seeded successfully"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
