"""
Health Check-in Agent
---------------------
LLM-powered health check-in orchestrator using Claude with tool calling.
Designed to walk patients through precomputed check-in questions and log responses.
"""

import os
import json
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None

# Load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.tools import (
    get_patient_context,
    get_recent_events,
    log_symptom_event,
    log_wellness_check,
    log_workflow_result,
    SymptomInput,
    WellnessInput,
    WorkflowResultInput,
    PatientContext
)
from schemas import TriageRoute


# ============================================================================
# Check-in System Prompt
# ============================================================================

CHECKIN_SYSTEM_PROMPT = """You are a friendly health check-in assistant for oncology patients. Your role is to conduct brief, supportive check-ins by asking precomputed questions and logging patient responses.

**YOUR STYLE:**
- Warm, conversational, and empathetic
- Ask one question at a time
- Acknowledge patient responses before moving on
- Use plain language, avoid medical jargon
- Keep responses concise (1-2 sentences when possible)

**YOUR WORKFLOW:**
1. Start by greeting the patient warmly
2. Work through the QUESTIONS TO ASK list, one at a time
3. When a patient reports symptoms, use log_symptom_event to record them
4. When discussing mood/anxiety, use log_wellness_check to record it
5. At the end, summarize key findings and use log_workflow_result to create an auditable record
6. Thank the patient and end the conversation

**QUESTIONS TO ASK:**
{questions_to_ask}

**PATIENT CONTEXT:**
Patient ID: {patient_id}
{patient_context}

**IMPORTANT RULES:**
- If the patient mentions severe symptoms (pain 8+/10, fever, difficulty breathing), acknowledge their concern and note it in your summary
- Always log symptoms and wellness data using the tools provided
- Be supportive but don't give medical advice - you're gathering information, not treating
- If you've asked all questions, summarize and close the conversation
- Keep track of which questions you've already asked - don't repeat them

**CLOSING:**
When you've covered all questions, create a workflow result with route "green" (routine check-in complete) unless there were concerning findings (use "yellow" then).
"""


# ============================================================================
# Request/Response Models
# ============================================================================

class CheckinState(BaseModel):
    """Conversation state for health check-in."""
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    patient_id: str
    questions: List[str] = Field(default_factory=list)
    questions_asked: List[int] = Field(default_factory=list, description="Indices of questions already asked")
    symptoms_logged: List[str] = Field(default_factory=list)
    wellness_logged: bool = False
    is_complete: bool = False


class CheckinRequest(BaseModel):
    """Request to the brain endpoint."""
    text: str = Field(..., description="User's spoken text (from STT)")
    state: CheckinState


class CheckinResponse(BaseModel):
    """Response from the brain endpoint."""
    text: str = Field(..., description="Agent's response text (for TTS)")
    state: CheckinState
    tool_calls_made: List[str] = Field(default_factory=list)


# ============================================================================
# Tool Definitions for Claude
# ============================================================================

TOOL_DEFINITIONS = [
    {
        "name": "log_symptom_event",
        "description": "Log a symptom reported by the patient. Call this whenever the patient mentions a physical symptom like pain, nausea, fatigue, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the symptom (e.g., 'Headache', 'Nausea', 'Fatigue')"
                },
                "severity": {
                    "type": "integer",
                    "description": "Severity on 0-10 scale (0=none, 10=worst imaginable)",
                    "minimum": 0,
                    "maximum": 10
                },
                "trend": {
                    "type": "string",
                    "enum": ["worsening", "stable", "improving"],
                    "description": "How the symptom is trending"
                },
                "notes": {
                    "type": "string",
                    "description": "Additional context from the patient"
                }
            },
            "required": ["name", "severity"]
        }
    },
    {
        "name": "log_wellness_check",
        "description": "Log the patient's emotional/mental wellness. Call this when discussing mood, anxiety, or emotional state.",
        "input_schema": {
            "type": "object",
            "properties": {
                "mood": {
                    "type": "integer",
                    "description": "Mood rating 1-5 (1=very low, 5=great)",
                    "minimum": 1,
                    "maximum": 5
                },
                "anxiety": {
                    "type": "integer",
                    "description": "Anxiety level 0-10 (0=none, 10=severe)",
                    "minimum": 0,
                    "maximum": 10
                },
                "notes": {
                    "type": "string",
                    "description": "Additional notes about emotional state"
                }
            },
            "required": ["mood", "anxiety"]
        }
    },
    {
        "name": "log_workflow_result",
        "description": "Create the final summary of the check-in. Call this at the END of the conversation to log the overall result.",
        "input_schema": {
            "type": "object",
            "properties": {
                "route": {
                    "type": "string",
                    "enum": ["green", "yellow", "red"],
                    "description": "green=routine check-in complete, yellow=needs clinician review, red=urgent"
                },
                "patient_summary": {
                    "type": "string",
                    "description": "Brief summary for the patient"
                },
                "clinician_summary": {
                    "type": "string",
                    "description": "Detailed summary for clinician review"
                },
                "safety_flags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Any concerning findings"
                }
            },
            "required": ["route", "patient_summary"]
        }
    }
]


# ============================================================================
# Agent Implementation
# ============================================================================

class CheckinAgent:
    """Health check-in agent using Claude with tool calling."""
    
    def __init__(self):
        self.client = None
        self._init_client()
    
    def _init_client(self):
        """Initialize the Anthropic client."""
        if not ANTHROPIC_AVAILABLE:
            raise ValueError("Anthropic package not installed. Install with: pip install anthropic")
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        
        self.client = Anthropic(api_key=api_key)
    
    def _build_system_prompt(self, patient_id: str, questions: List[str]) -> str:
        """Build the system prompt with patient context and questions."""
        # Format questions
        questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        
        # Try to get patient context
        patient_context = ""
        try:
            ctx = get_patient_context(patient_id)
            if ctx.profile:
                patient_context = f"""Name: {ctx.profile.name}
Cancer Type: {ctx.profile.cancer_type or 'Not specified'}
Current Treatment: {ctx.current_regimen or 'Not specified'}
ECOG Score: {ctx.ecog_score if ctx.ecog_score is not None else 'Not specified'}"""
        except Exception:
            patient_context = "Patient context not available"
        
        return CHECKIN_SYSTEM_PROMPT.format(
            questions_to_ask=questions_text or "No specific questions - conduct a general wellness check.",
            patient_id=patient_id,
            patient_context=patient_context
        )
    
    def _execute_tool(self, tool_name: str, tool_input: Dict, patient_id: str) -> tuple[Any, str]:
        """Execute a tool and return the result."""
        try:
            if tool_name == "log_symptom_event":
                symptom = SymptomInput(
                    name=tool_input["name"],
                    severity=tool_input["severity"],
                    trend=tool_input.get("trend"),
                    notes=tool_input.get("notes")
                )
                result = log_symptom_event(patient_id, symptom)
                return result, f"Logged symptom: {tool_input['name']} (severity {tool_input['severity']}/10)"
            
            elif tool_name == "log_wellness_check":
                wellness = WellnessInput(
                    mood=tool_input["mood"],
                    anxiety=tool_input["anxiety"],
                    notes=tool_input.get("notes")
                )
                result = log_wellness_check(patient_id, wellness)
                return result, f"Logged wellness: mood {tool_input['mood']}/5, anxiety {tool_input['anxiety']}/10"
            
            elif tool_name == "log_workflow_result":
                route_map = {"green": TriageRoute.GREEN, "yellow": TriageRoute.YELLOW, "red": TriageRoute.RED}
                workflow = WorkflowResultInput(
                    route=route_map.get(tool_input["route"], TriageRoute.GREEN),
                    patient_summary=tool_input["patient_summary"],
                    clinician_summary=tool_input.get("clinician_summary"),
                    safety_flags=tool_input.get("safety_flags", []),
                    confidence=1.0
                )
                result = log_workflow_result(patient_id, workflow, workflow_name="health_checkin")
                return result, f"Check-in complete: route={tool_input['route']}"
            
            else:
                return None, f"Unknown tool: {tool_name}"
        
        except Exception as e:
            return None, f"Tool error: {str(e)}"
    
    def process_message(self, request: CheckinRequest) -> CheckinResponse:
        """Process a user message and return the agent's response."""
        state = request.state
        patient_id = state.patient_id
        
        # Build messages for Claude
        system_prompt = self._build_system_prompt(patient_id, state.questions)
        
        # Convert state messages to Claude format
        claude_messages = []
        for msg in state.messages:
            claude_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add the new user message
        claude_messages.append({
            "role": "user",
            "content": request.text
        })
        
        # Call Claude with tools
        tool_calls_made = []
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=system_prompt,
                tools=TOOL_DEFINITIONS,
                messages=claude_messages
            )
            
            # Process response - handle tool calls
            final_text = ""
            
            while response.stop_reason == "tool_use":
                # Extract tool calls and text from response
                assistant_content = response.content
                tool_results = []
                
                for block in assistant_content:
                    if block.type == "text":
                        final_text += block.text
                    elif block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_id = block.id
                        
                        # Execute the tool
                        result, description = self._execute_tool(tool_name, tool_input, patient_id)
                        tool_calls_made.append(description)
                        
                        # Update state based on tool
                        if tool_name == "log_symptom_event":
                            state.symptoms_logged.append(tool_input["name"])
                        elif tool_name == "log_wellness_check":
                            state.wellness_logged = True
                        elif tool_name == "log_workflow_result":
                            state.is_complete = True
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": json.dumps({"success": True, "description": description})
                        })
                
                # Continue conversation with tool results
                claude_messages.append({"role": "assistant", "content": assistant_content})
                claude_messages.append({"role": "user", "content": tool_results})
                
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=1024,
                    system=system_prompt,
                    tools=TOOL_DEFINITIONS,
                    messages=claude_messages
                )
            
            # Get final text response
            for block in response.content:
                if block.type == "text":
                    final_text += block.text
            
            # Update state with new messages
            state.messages.append({"role": "user", "content": request.text})
            state.messages.append({"role": "assistant", "content": final_text})
            
            return CheckinResponse(
                text=final_text,
                state=state,
                tool_calls_made=tool_calls_made
            )
        
        except Exception as e:
            error_msg = f"I apologize, but I'm having some technical difficulties. Let me try again. Error: {str(e)}"
            state.messages.append({"role": "user", "content": request.text})
            state.messages.append({"role": "assistant", "content": error_msg})
            
            return CheckinResponse(
                text=error_msg,
                state=state,
                tool_calls_made=[]
            )
    
    def start_conversation(self, patient_id: str, questions: List[str]) -> CheckinResponse:
        """Start a new check-in conversation with an initial greeting."""
        state = CheckinState(
            patient_id=patient_id,
            questions=questions,
            messages=[]
        )
        
        # Build system prompt
        system_prompt = self._build_system_prompt(patient_id, questions)
        
        # Get initial greeting from Claude
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": "Please start the health check-in conversation with a warm greeting."
                }]
            )
            
            greeting = ""
            for block in response.content:
                if block.type == "text":
                    greeting += block.text
            
            state.messages.append({"role": "assistant", "content": greeting})
            
            return CheckinResponse(
                text=greeting,
                state=state,
                tool_calls_made=[]
            )
        
        except Exception as e:
            greeting = f"Hello! I'm here for your health check-in today. How are you feeling?"
            state.messages.append({"role": "assistant", "content": greeting})
            
            return CheckinResponse(
                text=greeting,
                state=state,
                tool_calls_made=[]
            )


# ============================================================================
# Module-level singleton
# ============================================================================

_agent_instance = None

def get_checkin_agent() -> CheckinAgent:
    """Get the singleton check-in agent instance."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = CheckinAgent()
    return _agent_instance

