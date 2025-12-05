from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from .schemas import PatientProfile, AgentSession, AgentAnalysis
from .store import store
from .agents.chat_orchestrator import process_chat_message, ChatState
from typing import List

app = FastAPI(title="Oncology RPM Console API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Oncology RPM Console API is running"}

@app.post("/profile", response_model=PatientProfile)
def create_or_update_profile(profile: PatientProfile):
    saved_profile = store.save_profile(profile)
    return saved_profile

@app.get("/profile", response_model=PatientProfile)
def get_active_profile():
    profile = store.get_active_profile()
    if not profile:
        # Return a default empty profile structure if none exists, or 404
        # For a developer console, it's nicer to return a default template
        # But let's return 404 for now so frontend knows to show "Create New"
        raise HTTPException(status_code=404, detail="No active profile found")
    return profile

@app.get("/profile/{profile_id}", response_model=PatientProfile)
def get_profile(profile_id: str):
    profile = store.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

# Agent Endpoints

@app.post("/agent/session", response_model=AgentSession)
def create_agent_session(
    agent_type: str = Body(...),
    transcript: str = Body(...),
    analysis: AgentAnalysis = Body(...)
):
    session = store.create_session(agent_type, transcript, analysis)
    return session

@app.get("/agent/sessions", response_model=List[AgentSession])
def get_agent_sessions():
    return store.get_sessions()

@app.post("/agent/chat")
def chat_with_agent(
    message: str = Body(...),
    agent_type: str = Body(...),
    state: ChatState = Body(...)
):
    """
    Endpoint for the Chat Simulator.
    Processes a single turn of conversation using the mock orchestrator.
    """
    return process_chat_message(message, state, agent_type)

@app.post("/agent/simulate", response_model=AgentAnalysis)
def simulate_analysis(agent_type: str = Body(...), transcript: str = Body(...)):
    """
    MOCK Endpoint: In a real app, this would call an LLM.
    Here we return static/semi-static data based on the prompt.
    """
    
    if agent_type == "patient_initiated_checkin":
        return {
            "event_type": "patient_initiated_checkin",
            "timestamp": "2025-12-04T18:45:00Z",
            "chief_complaint": "worsening headaches and nausea",
            "symptom_observations": [
                {
                    "name": "headache",
                    "severity_0_10": 8,
                    "onset_date": "2025-12-02",
                    "trend": "worsening",
                    "location": "right frontal",
                    "associated_symptoms": ["nausea", "photophobia"],
                    "functional_impact": "cannot work, stays in bed"
                },
                {
                    "name": "nausea",
                    "severity_0_10": 6,
                    "onset_relative_to_event": "2 days after last infusion"
                }
            ],
            "possible_relationships": [
                {
                    "symptom": "nausea",
                    "related_to": "chemo_infusion",
                    "related_event_id": "tx_2025_11_30",
                    "relationship_type": "temporal_association"
                }
            ],
            "safety_flags": {
                "red_flag_present": False,
                "recommendation_level": "yellow" 
            }
        }
    elif agent_type == "wellness_checkin":
        return {
            "event_type": "wellness_checkin",
            "timestamp": "2025-12-05T10:00:00Z",
            "mood": "anxious",
            "goals": "Walk the dog twice this week",
            "symptom_observations": [], # Usually empty for wellness unless reported
            "possible_relationships": [],
            "safety_flags": {
                 "red_flag_present": False,
                 "recommendation_level": "green" 
            }
        }
    else:
        # Fallback
        return {
            "event_type": "unknown",
            "timestamp": "2025-12-05T00:00:00Z",
            "symptom_observations": [],
            "possible_relationships": [],
             "safety_flags": {
                 "red_flag_present": False,
                 "recommendation_level": "green" 
            }
        }
