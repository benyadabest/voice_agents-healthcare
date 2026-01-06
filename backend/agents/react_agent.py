"""
ReAct Health Agent
------------------
A ReAct (Reasoning + Acting) agent for health assistance.

The agent follows the ReAct pattern:
1. Thought - Reason about what to do next
2. Action - Call a tool
3. Observation - See the result
4. Repeat until ready to give final answer
"""

import os
import json
import re
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.tools import (
    web_search,
    get_patient_context,
    get_care_plan_protocols,
    get_recent_events,
    log_symptom_event,
    log_wellness_check,
    log_workflow_result,
    create_followup_task,
    escalate_to_human,
    SymptomInput,
    WellnessInput,
    WorkflowResultInput,
    FollowupTaskInput,
    EscalationInput,
    PatientContext
)
from schemas import TriageRoute, TaskUrgency


# ============================================================================
# State and Response Models
# ============================================================================

class TraceStep(BaseModel):
    """A single step in the ReAct trace."""
    step_type: str  # "thought", "action", "observation"
    content: str
    tool_name: Optional[str] = None
    tool_input: Optional[Dict] = None


class ChatState(BaseModel):
    """Conversation state for the chat."""
    patient_id: str
    messages: List[Dict[str, str]] = Field(default_factory=list)
    conversation_id: str = ""


class ChatRequest(BaseModel):
    """Request to process a user message."""
    text: str
    state: ChatState


class ChatResponse(BaseModel):
    """Response from the agent."""
    text: str
    state: ChatState
    trace: List[TraceStep] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# System Prompt
# ============================================================================

REACT_SYSTEM_PROMPT = """You are a compassionate and knowledgeable health assistant helping oncology patients manage their care.

## Your Capabilities
You have access to tools that let you:
- Search the web for medical information (symptoms, conditions, drug interactions)
- Access patient context (profile, treatment regimen, recent history)
- View clinical protocols and guidelines
- Log symptoms and wellness check-ins
- Create follow-up tasks or escalate to clinicians

## Your Approach
1. **Listen carefully** - Ask clarifying questions before jumping to conclusions
2. **Gather context** - Use get_patient_context to understand who you're helping
3. **Research when needed** - Use web_search for medical information you're unsure about
4. **Be thorough** - Check recent events to understand symptom patterns
5. **Be empathetic** - This is a person dealing with a serious illness

## Patient Information
- Patient ID: {patient_id}
{patient_context}

## Guidelines
- Always start by understanding the patient's current concern
- If they report symptoms, ask about severity (0-10), duration, and trend (better/worse/same)
- Use web_search for any medical questions you need to verify
- Log symptoms using log_symptom_event when you have gathered the details
- For concerning symptoms, check care protocols with get_care_plan_protocols
- Escalate immediately for red flag symptoms (fever ≥100.4°F, severe breathing issues, chest pain, confusion)

## Communication Style
- Warm but professional
- Clear and jargon-free
- Ask one question at a time
- Acknowledge emotions and concerns
- Provide actionable guidance when appropriate

Remember: You're not replacing their care team. For urgent issues, always recommend contacting their provider or going to the ER."""


# ============================================================================
# Tool Definitions for Claude
# ============================================================================

TOOL_DEFINITIONS = [
    {
        "name": "web_search",
        "description": "Search the web for medical and health information. Use this to look up symptoms, conditions, drug interactions, treatment side effects, and medical guidelines.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query (e.g., 'carboplatin side effects', 'headache red flags oncology')"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_patient_context",
        "description": "Get the patient's profile, current treatment, and recent concerns. Call this at the start to understand who you're helping.",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "The patient's unique identifier"
                }
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "get_care_plan_protocols",
        "description": "Get clinical guidelines and escalation criteria for a specific symptom. Use this to check red flags and routing criteria.",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "The patient's unique identifier"
                },
                "chief_complaint": {
                    "type": "string",
                    "description": "The main symptom to get guidelines for (e.g., 'headache', 'nausea')"
                }
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "get_recent_events",
        "description": "Get recent symptom logs and events for the patient. Use this to check symptom trends and history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "The patient's unique identifier"
                },
                "window_hours": {
                    "type": "integer",
                    "description": "How many hours back to look (default 168 = 7 days)"
                },
                "event_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by event type: 'symptom', 'wellness', 'treatment'"
                }
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "log_symptom_event",
        "description": "Log a symptom reported by the patient. Call this after gathering symptom details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the symptom (e.g., 'Headache', 'Nausea')"
                },
                "severity": {
                    "type": "integer",
                    "description": "Severity on 0-10 scale",
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
        "description": "Log the patient's mood and anxiety levels.",
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
                    "description": "Anxiety level 0-10",
                    "minimum": 0,
                    "maximum": 10
                },
                "notes": {
                    "type": "string",
                    "description": "Additional notes about wellbeing"
                }
            },
            "required": ["mood", "anxiety"]
        }
    },
    {
        "name": "log_workflow_result",
        "description": "Log a triage decision with routing (green/yellow/red) and clinical summary.",
        "input_schema": {
            "type": "object",
            "properties": {
                "route": {
                    "type": "string",
                    "enum": ["green", "yellow", "red"],
                    "description": "Triage route: green=self-care, yellow=needs review, red=urgent"
                },
                "patient_summary": {
                    "type": "string",
                    "description": "Brief summary for the patient"
                },
                "clinician_summary": {
                    "type": "string",
                    "description": "Detailed summary for clinical review"
                },
                "safety_flags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Any red flags identified"
                },
                "escalation_trigger": {
                    "type": "string",
                    "description": "What triggered the escalation (if any)"
                }
            },
            "required": ["route", "patient_summary"]
        }
    },
    {
        "name": "create_followup_task",
        "description": "Create a task for clinician follow-up. Use for yellow-route situations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "urgency": {
                    "type": "string",
                    "enum": ["routine", "urgent", "stat"],
                    "description": "Task urgency level"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of what needs follow-up"
                },
                "context": {
                    "type": "string",
                    "description": "Additional context for the clinician"
                }
            },
            "required": ["summary"]
        }
    },
    {
        "name": "escalate_to_human",
        "description": "Immediately escalate to a human clinician. Use for red-route or urgent situations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Why this needs immediate attention"
                },
                "severity": {
                    "type": "string",
                    "enum": ["medium", "high", "critical"],
                    "description": "Severity of the situation"
                }
            },
            "required": ["reason"]
        }
    }
]


# ============================================================================
# Agent Implementation
# ============================================================================

class ReactAgent:
    """ReAct Health Agent with tool calling."""
    
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
    
    def _get_patient_context_text(self, patient_id: str) -> str:
        """Get formatted patient context for the system prompt."""
        try:
            ctx = get_patient_context(patient_id)
            if ctx.profile:
                return f"""- Name: {ctx.profile.name}
- Cancer Type: {ctx.profile.cancer_type or 'Not specified'}
- Current Treatment: {ctx.current_regimen or 'Not specified'}
- ECOG Score: {ctx.ecog_score if ctx.ecog_score is not None else 'Not specified'}
- Recent Concerns: {ctx.recent_concerns or 'None documented'}"""
        except Exception:
            pass
        return "- Patient context will be retrieved via tools"
    
    def _build_system_prompt(self, patient_id: str) -> str:
        """Build the system prompt with patient context."""
        patient_context = self._get_patient_context_text(patient_id)
        return REACT_SYSTEM_PROMPT.format(
            patient_id=patient_id,
            patient_context=patient_context
        )
    
    def _execute_tool(self, tool_name: str, tool_input: Dict, patient_id: str) -> tuple[Any, str]:
        """Execute a tool and return the result."""
        try:
            if tool_name == "web_search":
                result = web_search(
                    query=tool_input.get("query", ""),
                    max_results=tool_input.get("max_results", 5)
                )
                return result, json.dumps(result.dict(), indent=2)
            
            elif tool_name == "get_patient_context":
                pid = tool_input.get("patient_id", patient_id)
                result = get_patient_context(pid)
                return result, json.dumps(result.dict(), indent=2, default=str)
            
            elif tool_name == "get_care_plan_protocols":
                pid = tool_input.get("patient_id", patient_id)
                result = get_care_plan_protocols(
                    patient_id=pid,
                    chief_complaint=tool_input.get("chief_complaint")
                )
                return result, json.dumps([p.dict() for p in result], indent=2)
            
            elif tool_name == "get_recent_events":
                pid = tool_input.get("patient_id", patient_id)
                result = get_recent_events(
                    patient_id=pid,
                    window_hours=tool_input.get("window_hours", 168),
                    event_types=tool_input.get("event_types")
                )
                return result, json.dumps([e.dict() for e in result], indent=2, default=str)
            
            elif tool_name == "log_symptom_event":
                symptom = SymptomInput(
                    name=tool_input.get("name", "Unknown"),
                    severity=tool_input.get("severity", 5),
                    trend=tool_input.get("trend"),
                    notes=tool_input.get("notes")
                )
                result = log_symptom_event(patient_id, symptom)
                return result, f"Logged symptom: {symptom.name} (severity {symptom.severity}/10)"
            
            elif tool_name == "log_wellness_check":
                wellness = WellnessInput(
                    mood=tool_input.get("mood", 3),
                    anxiety=tool_input.get("anxiety", 5),
                    notes=tool_input.get("notes")
                )
                result = log_wellness_check(patient_id, wellness)
                return result, f"Logged wellness: mood {wellness.mood}/5, anxiety {wellness.anxiety}/10"
            
            elif tool_name == "log_workflow_result":
                route_str = tool_input.get("route", "green")
                route = TriageRoute(route_str)
                workflow_result = WorkflowResultInput(
                    route=route,
                    patient_summary=tool_input.get("patient_summary", ""),
                    clinician_summary=tool_input.get("clinician_summary"),
                    safety_flags=tool_input.get("safety_flags", []),
                    escalation_trigger=tool_input.get("escalation_trigger")
                )
                result = log_workflow_result(patient_id, workflow_result)
                return result, f"Logged triage result: {route_str.upper()} route"
            
            elif tool_name == "create_followup_task":
                urgency_str = tool_input.get("urgency", "routine")
                urgency = TaskUrgency(urgency_str)
                task = FollowupTaskInput(
                    urgency=urgency,
                    summary=tool_input.get("summary", ""),
                    context=tool_input.get("context")
                )
                result = create_followup_task(patient_id, task)
                return result, f"Created follow-up task: {task.summary}"
            
            elif tool_name == "escalate_to_human":
                escalation = EscalationInput(
                    reason=tool_input.get("reason", ""),
                    severity=tool_input.get("severity", "high")
                )
                result = escalate_to_human(patient_id, escalation)
                return result, f"ESCALATED: {escalation.reason} - Care team notified"
            
            else:
                return None, f"Unknown tool: {tool_name}"
                
        except Exception as e:
            return None, f"Tool error: {str(e)}"
    
    def process_message(self, request: ChatRequest) -> ChatResponse:
        """Process a user message using the ReAct loop."""
        state = request.state
        patient_id = state.patient_id
        
        # Build system prompt
        system_prompt = self._build_system_prompt(patient_id)
        
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
        
        # ReAct trace for this turn
        trace = []
        tool_calls = []
        
        try:
            # Initial call to Claude
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system_prompt,
                tools=TOOL_DEFINITIONS,
                messages=claude_messages
            )
            
            # ReAct loop - keep going while Claude wants to use tools
            while response.stop_reason == "tool_use":
                # Extract text (Thought) and tool calls (Action)
                thought_text = ""
                tool_use_blocks = []
                
                for block in response.content:
                    if block.type == "text":
                        thought_text = block.text
                        if thought_text:
                            trace.append(TraceStep(
                                step_type="thought",
                                content=thought_text
                            ))
                    elif block.type == "tool_use":
                        tool_use_blocks.append(block)
                
                # Process each tool call
                tool_results = []
                for tool_block in tool_use_blocks:
                    tool_name = tool_block.name
                    tool_input = tool_block.input
                    
                    # Add Action to trace
                    trace.append(TraceStep(
                        step_type="action",
                        content=f"Calling {tool_name}",
                        tool_name=tool_name,
                        tool_input=tool_input
                    ))
                    
                    # Execute the tool
                    result, result_str = self._execute_tool(tool_name, tool_input, patient_id)
                    
                    # Add Observation to trace
                    trace.append(TraceStep(
                        step_type="observation",
                        content=result_str[:1000]  # Truncate long results
                    ))
                    
                    # Record for response
                    tool_calls.append({
                        "tool": tool_name,
                        "input": tool_input,
                        "output": result_str[:500]
                    })
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": result_str
                    })
                
                # Continue the conversation with tool results
                claude_messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                claude_messages.append({
                    "role": "user",
                    "content": tool_results
                })
                
                # Call Claude again
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=2048,
                    system=system_prompt,
                    tools=TOOL_DEFINITIONS,
                    messages=claude_messages
                )
            
            # Extract final response text
            final_text = ""
            for block in response.content:
                if block.type == "text":
                    final_text += block.text
            
            # Update state with the conversation
            state.messages.append({"role": "user", "content": request.text})
            state.messages.append({"role": "assistant", "content": final_text})
            
            return ChatResponse(
                text=final_text,
                state=state,
                trace=trace,
                tool_calls=tool_calls
            )
            
        except Exception as e:
            error_msg = f"I apologize, I encountered an issue. Please try again or contact your care team if urgent. (Error: {str(e)})"
            state.messages.append({"role": "user", "content": request.text})
            state.messages.append({"role": "assistant", "content": error_msg})
            
            return ChatResponse(
                text=error_msg,
                state=state,
                trace=trace,
                tool_calls=tool_calls
            )
    
    def start_conversation(self, patient_id: str) -> ChatResponse:
        """Start a new conversation with a greeting."""
        import uuid
        
        state = ChatState(
            patient_id=patient_id,
            messages=[],
            conversation_id=str(uuid.uuid4())
        )
        
        # Build system prompt
        system_prompt = self._build_system_prompt(patient_id)
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": "Please introduce yourself and ask how you can help today."
                }]
            )
            
            greeting = ""
            for block in response.content:
                if block.type == "text":
                    greeting += block.text
            
            state.messages.append({"role": "assistant", "content": greeting})
            
            return ChatResponse(
                text=greeting,
                state=state,
                trace=[],
                tool_calls=[]
            )
            
        except Exception as e:
            greeting = "Hello! I'm your health assistant. How can I help you today?"
            state.messages.append({"role": "assistant", "content": greeting})
            
            return ChatResponse(
                text=greeting,
                state=state,
                trace=[TraceStep(step_type="thought", content=f"Error initializing: {str(e)}")],
                tool_calls=[]
            )


# ============================================================================
# Module-level singleton
# ============================================================================

_agent_instance = None

def get_agent() -> ReactAgent:
    """Get or create the ReAct agent singleton."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = ReactAgent()
    return _agent_instance

