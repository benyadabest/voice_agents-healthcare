from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import inspect

# Load environment variables from .env file
load_dotenv()
from schemas import (
    PatientProfile, AgentSession, AgentAnalysis, BaseEvent, SymptomEvent, 
    WellnessEvent, TreatmentEvent, LifestyleEvent, ToolCallRequest, ToolCallResponse,
    Annotation, SavedView
)
from pydantic import BaseModel
from store import store
from agents.chat_orchestrator import process_chat_message, ChatState
from llm.profile_generator import generate_patient_profile_and_events, generate_events_from_prompt
from agents.tools import TOOL_REGISTRY
from agents.elevenlabs_agent import (
    compute_checkin_questions,
    PrecomputedQuestions
)
from agents.checkin_agent import (
    get_checkin_agent,
    CheckinRequest,
    CheckinResponse,
    CheckinState
)
from agents.react_agent import (
    get_agent as get_react_agent,
    ChatRequest,
    ChatResponse,
    ChatState,
    TraceStep
)
from typing import List, Union, Optional, Dict, Any




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

@app.get("/profiles", response_model=List[PatientProfile])
def list_profiles():
    return store.list_profiles()

@app.post("/profile/switch/{profile_id}", response_model=PatientProfile)
def switch_profile(profile_id: str):
    profile = store.switch_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.delete("/profile/{profile_id}")
def delete_profile(profile_id: str):
    success = store.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile deleted successfully"}

@app.post("/profile/new", response_model=PatientProfile)
def create_new_profile(name: str = Body(..., embed=True)):
    return store.create_new_profile(name)

class GenerateProfileRequest(BaseModel):
    description: str
    name: Optional[str] = None
    months_of_history: int = 6

@app.post("/profile/generate", response_model=PatientProfile)
def generate_profile_from_description(request: GenerateProfileRequest):
    """
    Generate a patient profile and realistic event history from a free-text description.
    Uses Anthropic Claude to create medically consistent data.
    """
    try:
        profile, events = generate_patient_profile_and_events(
            description=request.description,
            name=request.name,
            months_of_history=request.months_of_history
        )
        created_profile = store.create_profile_with_events(profile, events)
        return created_profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating profile: {str(e)}")

@app.get("/profile", response_model=PatientProfile)
def get_active_profile():
    profile = store.get_active_profile()
    if not profile:
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

# Tool Webhook Endpoints

@app.get("/agent/tools/definitions")
def get_tool_definitions():
    """Returns definitions of all available tools for agent discovery."""
    definitions = {}
    for name, tool in TOOL_REGISTRY.items():
        definitions[name] = {
            "description": tool["description"],
            "parameters": tool["parameters"]
        }
    return definitions

import inspect

@app.post("/agent/tools/execute", response_model=ToolCallResponse)
def execute_tool_webhook(request: ToolCallRequest):
    """
    Webhook endpoint to execute agent tools.
    Routes calls to the appropriate tool function in tools.py.
    """
    if request.tool_name not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Tool '{request.tool_name}' not found")
    
    tool = TOOL_REGISTRY[request.tool_name]
    func = tool["function"]
    
    try:
        # Get function signature to check parameter types
        sig = inspect.signature(func)
        bound_args = {}
        
        for name, param in sig.parameters.items():
            if name in request.arguments:
                val = request.arguments[name]
                # If parameter has a Pydantic model type hint, convert dict to model
                if hasattr(param.annotation, "__base__") and param.annotation.__base__ == BaseModel:
                    if isinstance(val, dict):
                        bound_args[name] = param.annotation(**val)
                    else:
                        bound_args[name] = val
                else:
                    bound_args[name] = val
        
        # Execute the tool function
        result = func(**bound_args)
        
        # Convert result to dict for JSON serialization if it's a Pydantic model
        def to_dict(obj):
            if hasattr(obj, "dict"):
                return obj.dict()
            if isinstance(obj, list):
                return [to_dict(item) for item in obj]
            if isinstance(obj, dict):
                return {k: to_dict(v) for k, v in obj.items()}
            return obj

        return ToolCallResponse(
            tool_name=request.tool_name,
            result=to_dict(result),
            status="success"
        )
    except Exception as e:
        return ToolCallResponse(
            tool_name=request.tool_name,
            result=None,
            status="error",
            error=str(e)
        )



# Timeline Endpoints

@app.post("/events", response_model=Union[SymptomEvent, WellnessEvent, TreatmentEvent, LifestyleEvent, BaseEvent])
def create_event(event_data: dict = Body(...)):
    try:
        return store.add_event(event_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/events/{patient_id}", response_model=List[Union[SymptomEvent, WellnessEvent, TreatmentEvent, LifestyleEvent, BaseEvent]])
def get_patient_events(patient_id: str):
    return store.get_events(patient_id)

@app.delete("/events/{event_id}")
def delete_event(event_id: str):
    success = store.delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted successfully"}

# Annotation Endpoints

@app.post("/annotations", response_model=Annotation)
def create_annotation(annotation: Annotation):
    """Create a new annotation."""
    return store.add_annotation(annotation)

@app.get("/annotations/{patient_id}", response_model=List[Annotation])
def get_annotations(patient_id: str):
    """Get all annotations for a patient."""
    return store.get_annotations(patient_id)

@app.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    """Delete an annotation."""
    success = store.delete_annotation(annotation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"message": "Annotation deleted successfully"}

# Saved View Endpoints

@app.post("/views", response_model=SavedView)
def create_saved_view(view: SavedView):
    """Create a new saved view."""
    return store.add_saved_view(view)

@app.get("/views/{patient_id}", response_model=List[SavedView])
def get_saved_views(patient_id: str):
    """Get all saved views for a patient."""
    return store.get_saved_views(patient_id)

@app.delete("/views/{view_id}")
def delete_saved_view(view_id: str):
    """Delete a saved view."""
    success = store.delete_saved_view(view_id)
    if not success:
        raise HTTPException(status_code=404, detail="Saved view not found")
    return {"message": "Saved view deleted successfully"}

# Bulk Event Creation Endpoint

class BulkEventRequest(BaseModel):
    patient_id: str
    prompt: str

@app.post("/events/bulk-create")
def create_bulk_events(request: BulkEventRequest):
    """
    Create multiple events from a natural language prompt.
    Uses Claude to parse the description and generate structured events.
    
    Example prompt: "Last week I had headaches on Monday and Wednesday, 
    started a new diet on Tuesday, and felt anxious on Thursday."
    """
    try:
        # Generate events from the prompt using LLM
        events = generate_events_from_prompt(
            patient_id=request.patient_id,
            prompt=request.prompt
        )
        
        # Save all generated events to the store
        saved_events = []
        for event in events:
            saved_event = store.add_event(event.dict())
            saved_events.append(saved_event)
        
        return {
            "message": f"Successfully created {len(saved_events)} events",
            "events": [e.dict() for e in saved_events]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating events: {str(e)}")


# ============================================================================
# Voice Check-In Endpoints
# ============================================================================

class PrecomputeQuestionsRequest(BaseModel):
    patient_id: str
    window_hours: int = 84


@app.post("/voice/precompute-questions", response_model=PrecomputedQuestions)
def precompute_questions(request: PrecomputeQuestionsRequest):
    """
    Preview the precomputed check-in questions for a patient.
    
    This analyzes recent events and generates 5 targeted questions based on:
    - Worsening symptoms
    - Post-treatment risk windows
    - Missing wellness data
    - Symptom trends and patterns
    
    Useful for debugging/previewing before starting a voice session.
    
    Args:
        patient_id: The patient to analyze
        window_hours: How far back to look (default ~3.5 days)
        
    Returns:
        PrecomputedQuestions with questions and reasoning
    """
    try:
        profile = store.get_profile(request.patient_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Patient not found: {request.patient_id}")
        
        result = compute_checkin_questions(
            patient_id=request.patient_id,
            window_hours=request.window_hours
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing questions: {str(e)}")

# In-memory storage for custom questions per patient
_custom_questions: Dict[str, List[str]] = {}


class BrainStartRequest(BaseModel):
    """Request to start a new check-in conversation."""
    patient_id: str
    window_hours: int = 84


class BrainStartResponse(BaseModel):
    """Response from starting a check-in conversation."""
    text: str
    state: Dict[str, Any]
    questions: List[str]


class BrainMessageRequest(BaseModel):
    """Request to send a message to the brain."""
    text: str
    state: Dict[str, Any]


class BrainMessageResponse(BaseModel):
    """Response from the brain."""
    text: str
    state: Dict[str, Any]
    tool_calls_made: List[str]
    is_complete: bool


class AddQuestionRequest(BaseModel):
    """Request to add a custom question."""
    patient_id: str
    question: str


class CustomQuestionsResponse(BaseModel):
    """Response with custom questions."""
    patient_id: str
    questions: List[str]


@app.post("/voice/brain/start", response_model=BrainStartResponse)
def start_brain_conversation(request: BrainStartRequest):
    """
    Start a new health check-in conversation.
    
    This endpoint:
    1. Computes precomputed questions for the patient
    2. Adds any custom questions for this patient
    3. Starts the conversation with the LLM agent
    
    Returns:
        Initial greeting and conversation state
    """
    # Validate patient exists
    profile = store.get_profile(request.patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Patient not found: {request.patient_id}")
    
    try:
        # Precompute questions
        precomputed = compute_checkin_questions(
            patient_id=request.patient_id,
            window_hours=request.window_hours
        )
        
        # Add any custom questions
        all_questions = list(precomputed.questions)
        if request.patient_id in _custom_questions:
            all_questions.extend(_custom_questions[request.patient_id])
        
        # Start conversation
        agent = get_checkin_agent()
        response = agent.start_conversation(
            patient_id=request.patient_id,
            questions=all_questions
        )
        
        return BrainStartResponse(
            text=response.text,
            state=response.state.dict(),
            questions=all_questions
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting conversation: {str(e)}")


@app.post("/voice/brain", response_model=BrainMessageResponse)
def process_brain_message(request: BrainMessageRequest):
    """
    Process a user message through the LLM brain.
    
    This is the main endpoint for the voice check-in:
    1. Receives transcribed text from STT
    2. Processes through Claude with tool access
    3. Returns response text for TTS
    
    Args:
        text: User's spoken text (from STT)
        state: Current conversation state
        
    Returns:
        Agent's response text and updated state
    """
    try:
        # Reconstruct CheckinState from dict
        state = CheckinState(**request.state)
        
        # Process message
        agent = get_checkin_agent()
        checkin_request = CheckinRequest(
            text=request.text,
            state=state
        )
        
        response = agent.process_message(checkin_request)
        
        return BrainMessageResponse(
            text=response.text,
            state=response.state.dict(),
            tool_calls_made=response.tool_calls_made,
            is_complete=response.state.is_complete
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")


@app.post("/voice/questions/add")
def add_custom_question(request: AddQuestionRequest):
    """
    Add a custom question to a patient's check-in list.
    
    These questions will be appended to the precomputed questions
    for the next check-in session.
    
    Args:
        patient_id: The patient to add the question for
        question: The question text
        
    Returns:
        Updated list of custom questions for this patient
    """
    # Validate patient exists
    profile = store.get_profile(request.patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Patient not found: {request.patient_id}")
    
    # Add to custom questions
    if request.patient_id not in _custom_questions:
        _custom_questions[request.patient_id] = []
    
    _custom_questions[request.patient_id].append(request.question)
    
    return {
        "message": "Question added successfully",
        "patient_id": request.patient_id,
        "custom_questions": _custom_questions[request.patient_id]
    }


@app.get("/voice/questions/{patient_id}", response_model=CustomQuestionsResponse)
def get_custom_questions(patient_id: str):
    """
    Get custom questions for a patient.
    
    Returns:
        List of custom questions added for this patient
    """
    return CustomQuestionsResponse(
        patient_id=patient_id,
        questions=_custom_questions.get(patient_id, [])
    )


@app.delete("/voice/questions/{patient_id}/{index}")
def delete_custom_question(patient_id: str, index: int):
    """
    Delete a custom question by index.
    
    Args:
        patient_id: The patient ID
        index: The index of the question to delete (0-based)
        
    Returns:
        Updated list of custom questions
    """
    if patient_id not in _custom_questions:
        raise HTTPException(status_code=404, detail="No custom questions for this patient")
    
    if index < 0 or index >= len(_custom_questions[patient_id]):
        raise HTTPException(status_code=404, detail="Question index out of range")
    
    deleted = _custom_questions[patient_id].pop(index)
    
    return {
        "message": "Question deleted successfully",
        "deleted_question": deleted,
        "custom_questions": _custom_questions[patient_id]
    }


# ============================================================================
# ReAct Health Chat Endpoints
# ============================================================================

class ChatStartRequest(BaseModel):
    """Request to start a new chat conversation."""
    patient_id: str


class ChatStartResponse(BaseModel):
    """Response from starting a chat conversation."""
    text: str
    state: Dict[str, Any]
    conversation_id: str


class ChatMessageRequest(BaseModel):
    """Request to send a message in the chat."""
    text: str
    state: Dict[str, Any]


class ChatMessageResponse(BaseModel):
    """Response from the chat agent."""
    text: str
    state: Dict[str, Any]
    trace: List[Dict[str, Any]]
    tool_calls: List[Dict[str, Any]]


@app.post("/chat/start", response_model=ChatStartResponse)
def start_chat_conversation(request: ChatStartRequest):
    """
    Start a new health chat conversation with the ReAct agent.
    
    This endpoint:
    1. Validates the patient exists
    2. Initializes the ReAct agent with patient context
    3. Returns an initial greeting
    
    Returns:
        Initial greeting and conversation state
    """
    # Validate patient exists
    profile = store.get_profile(request.patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Patient not found: {request.patient_id}")
    
    try:
        agent = get_react_agent()
        response = agent.start_conversation(patient_id=request.patient_id)
        
        return ChatStartResponse(
            text=response.text,
            state=response.state.dict(),
            conversation_id=response.state.conversation_id
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting conversation: {str(e)}")


@app.post("/chat/message", response_model=ChatMessageResponse)
def send_chat_message(request: ChatMessageRequest):
    """
    Process a user message through the ReAct health agent.
    
    This is the main endpoint for the health chat:
    1. Receives user text
    2. Processes through Claude with ReAct loop (Thought/Action/Observation)
    3. Returns response with reasoning trace
    
    Args:
        text: User's message
        state: Current conversation state
        
    Returns:
        Agent's response text, updated state, and reasoning trace
    """
    try:
        # Reconstruct ChatState from dict
        state = ChatState(**request.state)
        
        # Process message
        agent = get_react_agent()
        chat_request = ChatRequest(
            text=request.text,
            state=state
        )
        
        response = agent.process_message(chat_request)
        
        return ChatMessageResponse(
            text=response.text,
            state=response.state.dict(),
            trace=[step.dict() for step in response.trace],
            tool_calls=response.tool_calls
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")
