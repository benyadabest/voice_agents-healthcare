"""
ElevenLabs Voice Agent Integration
----------------------------------
Handles ElevenLabs Conversational AI agent creation, session management,
and dynamic question precomputation for oncology triage check-ins.

This module provides:
- System prompt template with {{questions_to_ask}} placeholder
- Agent creation and configuration via ElevenLabs API
- Precompute logic for generating patient-specific check-in questions
- Signed URL generation for widget embedding with overrides
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from elevenlabs.client import ElevenLabs
from elevenlabs.types import ConversationalConfig

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store import store
from schemas import EventType


# ============================================================================
# System Prompt Template
# ============================================================================

SYSTEM_PROMPT_TEMPLATE = """You are a clinical voice triage intake agent for an oncology practice. Your job is to collect structured symptom data, screen for red flags, and route using deterministic protocols. The backend is the source of truth; all outputs must be auditable, replayable, and logged.

You do not diagnose or provide medical advice. You do ask targeted questions, summarize accurately, and escalate conservatively.

*HARD RULES*
Protocol router is the decision authority. Treat get_care_plan_protocols(...) output as authoritative for escalation level (green/yellow/red), required follow-ups, patient wording, and references. Do not override it.
No invented medical thresholds. Never introduce numeric thresholds (e.g., fever cutoffs, stool counts, BP/HR cutoffs) unless explicitly returned by the protocol router tool or explicitly present in clinic-approved KB content.
Red-flag conservative default: If any red flag is YES / UNSURE / CAN'T ASSESS, or the caller is deteriorating → escalate_to_human immediately.
Do not delay escalation to finish intake. You may continue gathering key facts only if safe, but escalation happens first.
Always log outcomes: log_workflow_result(...) must be written for every interaction (even if disconnected or escalated early). Log missing_info when incomplete.
No medication changes: Never recommend starting/stopping meds, dose changes, or prescribing. Never advise holding chemo/immunotherapy/oral oncolytics.
Respect privacy & accuracy: Capture the caller's exact words in summaries/evidence. Don't guess.

*TOOL USE*
If {{patient_id}} is present, call get_patient_context({{patient_id}}) immediately; otherwise ask for patient ID/DOB and then call it.
Required tool calling order (strict):
As soon as patient_id is known: call get_patient_context(patient_id) immediately.
If patient_id is not available yet: ask for it early (or collect minimum safety info first if urgent).
(Optional but preferred after patient context) call get_recent_events(patient_id, window_days=14) to detect recent symptoms, trends, contradictions, regimen timing, and missed follow-ups.
Run red-flag screen (KB-A) early and explicitly.
Before any routing decision: call get_care_plan_protocols(patient_context, complaint, red_flags).
If a life-threatening red flag is present: call escalate_to_human(...) immediately first, then (if feasible) call get_care_plan_protocols(...) to attach protocol references for documentation—do not delay escalation.
Logging:
When symptoms are collected: call log_symptom_event(...) (structured measurements + raw_text + provenance + timestamp).
If mood/anxiety is discussed: call log_wellness_check(...).
Always end with log_workflow_result(...) (route, red_flags, summaries, evidence pointers, confidence, missing_info, timestamp).
Safety tool:
Use escalate_to_human(patient_id, reason, urgency_level, evidence) whenever red flags, uncertainty, tool failure, patient request, or inability to assess.

*TRIAGE FLOW*
Open & identify
Confirm: patient vs caregiver, whether caregiver is with patient.
Collect: current location (city/state) and callback number.
If immediate danger: advise emergency services per local policy and escalate_to_human (red).
Patient context
Obtain patient_id and immediately call get_patient_context(patient_id).
Optionally call get_recent_events(...) to inform questioning.
Red-flag screen (mandatory)
Use KB-A checklist. If YES/UNSURE/UNASSESSABLE → escalate_to_human now (urgency red) and clearly state what triggered it.
Structured symptom intake (for each main complaint)
Onset, duration, severity (patient descriptor), trend (better/worse/same), functional impact.
Associated symptoms, relevant negatives (focused), and objective readings (temperature and time/method if applicable).
Treatment timing: last infusion/dose timing if known; any recent changes.
Protocol routing (mandatory before decision)
Call get_care_plan_protocols(patient_context, complaint, red_flags).
Ask any required_followups returned.
Use returned patient_wording_templates for what you say next.
Communicate next step
State the routing outcome plainly (e.g., "I'm escalating this now to the on-call clinician" or "This can be handled with a same-day nurse call").
If escalation: confirm callback number and availability.
Finalize logging
log_symptom_event for structured symptom data.
log_workflow_result with:
route (green/yellow/red + destination)
red_flags (explicit list)
patient_summary (plain language)
clinician_summary (structured triage note)
evidence (protocol router references + key Q&A + any recent events used)
confidence (low/medium/high or numeric per system convention)
missing_info (explicit list)

*STYLE*
Calm, concise, one question at a time.
Use plain language; avoid jargon.
Confirm key facts ("Just to confirm: …").
Use safety-forward phrasing: "I can't give medical advice, but I can help route you to the right clinician."
Never minimize symptoms; if caller disagrees or is distressed → escalate.

*FAILURE MODES*
No patient_id / can't retrieve context: proceed with red-flag screen and minimum intake, then escalate_to_human; log missing_info=["patient_context_unavailable"].
Protocol router tool failure/timeout: escalate_to_human (yellow/red based on symptoms); log tool error in evidence.
Conflicting information / unreliable historian / language barrier: treat as unassessable → escalate.
Call ends early: still write log_workflow_result with what you have and explicit missing fields.

*QUESTIONS TO ASK*
{{questions_to_ask}}
"""


# ============================================================================
# Response Models
# ============================================================================

class PrecomputedQuestions(BaseModel):
    """Result of question precomputation."""
    patient_id: str
    questions: List[str]
    reasoning: List[str] = Field(default_factory=list, description="Why each question was selected")
    context_summary: Optional[str] = None


class AgentConfig(BaseModel):
    """ElevenLabs agent configuration."""
    agent_id: str
    name: str
    voice_id: str
    webhook_url: str
    created_at: str


class SessionStartResult(BaseModel):
    """Result of starting a voice session."""
    signed_url: str
    agent_id: str
    patient_id: str
    questions: List[str]
    expires_at: Optional[str] = None


# ============================================================================
# ElevenLabs Client Wrapper
# ============================================================================

class ElevenLabsAgentManager:
    """Manages ElevenLabs agent lifecycle and session creation."""
    
    CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "elevenlabs_config.json")
    
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Default: Rachel
        self.webhook_url = os.getenv("NGROK_WEBHOOK_URL", "")
        self._agent_id = os.getenv("ELEVENLABS_AGENT_ID")
        self._client = None
        
        # Load persisted agent ID from config file
        self._load_config()
    
    def _load_config(self):
        """Load persisted configuration from file."""
        import json
        if os.path.exists(self.CONFIG_FILE):
            try:
                with open(self.CONFIG_FILE, 'r') as f:
                    config = json.load(f)
                    if not self._agent_id and config.get('agent_id'):
                        self._agent_id = config['agent_id']
            except Exception:
                pass
    
    def _save_config(self):
        """Persist configuration to file."""
        import json
        config = {'agent_id': self._agent_id}
        try:
            with open(self.CONFIG_FILE, 'w') as f:
                json.dump(config, f)
        except Exception:
            pass
    
    @property
    def client(self) -> ElevenLabs:
        """Lazy-initialize the ElevenLabs client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError("ELEVENLABS_API_KEY environment variable not set")
            self._client = ElevenLabs(api_key=self.api_key)
        return self._client
    
    @property
    def agent_id(self) -> Optional[str]:
        """Get the current agent ID."""
        return self._agent_id
    
    @agent_id.setter
    def agent_id(self, value: str):
        """Set the agent ID and persist it."""
        self._agent_id = value
        self._save_config()
    
    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Generate tool definitions for the ElevenLabs agent.
        These map to our existing webhook at /agent/tools/execute
        """
        webhook_base = self.webhook_url.rstrip("/")
        
        return [
            {
                "type": "webhook",
                "name": "get_patient_context",
                "description": "Retrieve the full patient context including profile, treatment info, and concerns. Use this at the start of a conversation.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "get_patient_context",
                        "arguments": {"patient_id": "{{patient_id}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"}
                    },
                    "required": ["patient_id"]
                }
            },
            {
                "type": "webhook",
                "name": "get_care_plan_protocols",
                "description": "Get clinical protocols and escalation criteria for a patient's complaint. This is the authority for RED/YELLOW thresholds.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "get_care_plan_protocols",
                        "arguments": {"patient_id": "{{patient_id}}", "chief_complaint": "{{chief_complaint}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "chief_complaint": {"type": "string", "description": "The symptom to get specific guidelines for"}
                    },
                    "required": ["patient_id"]
                }
            },
            {
                "type": "webhook",
                "name": "get_recent_events",
                "description": "Query historical events within a time window for trend detection.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "get_recent_events",
                        "arguments": {"patient_id": "{{patient_id}}", "window_hours": "{{window_hours}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "window_hours": {"type": "integer", "description": "How many hours back to look (default 168)"}
                    },
                    "required": ["patient_id"]
                }
            },
            {
                "type": "webhook",
                "name": "log_symptom_event",
                "description": "Log a structured symptom report to the patient's timeline.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "log_symptom_event",
                        "arguments": {"patient_id": "{{patient_id}}", "symptom": "{{symptom}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "symptom": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "severity": {"type": "integer"},
                                "trend": {"type": "string"},
                                "notes": {"type": "string"}
                            },
                            "required": ["name", "severity"]
                        }
                    },
                    "required": ["patient_id", "symptom"]
                }
            },
            {
                "type": "webhook",
                "name": "log_wellness_check",
                "description": "Log mood and anxiety scores during a wellness check-in.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "log_wellness_check",
                        "arguments": {"patient_id": "{{patient_id}}", "wellness": "{{wellness}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "wellness": {
                            "type": "object",
                            "properties": {
                                "mood": {"type": "integer"},
                                "anxiety": {"type": "integer"},
                                "notes": {"type": "string"}
                            },
                            "required": ["mood", "anxiety"]
                        }
                    },
                    "required": ["patient_id", "wellness"]
                }
            },
            {
                "type": "webhook",
                "name": "log_workflow_result",
                "description": "Create the auditable artifact for the triage encounter with routing decision.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "log_workflow_result",
                        "arguments": {"patient_id": "{{patient_id}}", "result": "{{result}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "result": {
                            "type": "object",
                            "properties": {
                                "route": {"type": "string", "enum": ["green", "yellow", "red"]},
                                "patient_summary": {"type": "string"},
                                "clinician_summary": {"type": "string"},
                                "safety_flags": {"type": "array", "items": {"type": "string"}},
                                "escalation_trigger": {"type": "string"},
                                "confidence": {"type": "number"}
                            },
                            "required": ["route", "patient_summary"]
                        }
                    },
                    "required": ["patient_id", "result"]
                }
            },
            {
                "type": "webhook",
                "name": "create_followup_task",
                "description": "Generate a follow-up item for the clinician's queue.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "create_followup_task",
                        "arguments": {"patient_id": "{{patient_id}}", "task": "{{task}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "task": {
                            "type": "object",
                            "properties": {
                                "urgency": {"type": "string", "enum": ["routine", "urgent", "stat"]},
                                "summary": {"type": "string"},
                                "triggered_by": {"type": "string"}
                            },
                            "required": ["urgency", "summary"]
                        }
                    },
                    "required": ["patient_id", "task"]
                }
            },
            {
                "type": "webhook",
                "name": "escalate_to_human",
                "description": "Trigger an immediate escalation to a live human clinician.",
                "webhook": {
                    "url": f"{webhook_base}/agent/tools/execute",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "tool_name": "escalate_to_human",
                        "arguments": {"patient_id": "{{patient_id}}", "escalation": "{{escalation}}"}
                    }
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
                        "escalation": {
                            "type": "object",
                            "properties": {
                                "reason": {"type": "string"},
                                "severity": {"type": "string", "enum": ["medium", "high", "critical"]},
                                "contact_preference": {"type": "string"}
                            },
                            "required": ["reason"]
                        }
                    },
                    "required": ["patient_id", "escalation"]
                }
            }
        ]
    
    def create_agent(self, name: str = "Oncology Triage Agent") -> AgentConfig:
        """
        Create a new ElevenLabs conversational agent with the triage system prompt.
        
        Args:
            name: Display name for the agent
            
        Returns:
            AgentConfig with the created agent's details
        """
        # Render the prompt template with a placeholder for questions
        # (will be overridden per-session)
        initial_prompt = SYSTEM_PROMPT_TEMPLATE.replace(
            "{{questions_to_ask}}", 
            "1. How have you been feeling overall since your last check-in?\n"
            "2. Have you experienced any new or worsening symptoms?\n"
            "3. Any fever, chills, or signs of infection?\n"
            "4. How is your pain level today?\n"
            "5. Is there anything else on your mind you'd like to discuss?"
        )
        
        # Create the agent via ElevenLabs API
        agent = self.client.conversational_ai.agents.create(
            name=name,
            conversation_config={
                "agent": {
                    "prompt": {
                        "prompt": initial_prompt
                    },
                    "first_message": "Hello, this is your oncology care team's triage line. Before we begin, are you the patient, or are you calling on behalf of someone?",
                    "language": "en"
                },
                "tts": {
                    "voice_id": self.voice_id
                }
            },
            platform_settings={
                "widget": {
                    "variant": "compact",
                    "avatar": {
                        "type": "orb"
                    }
                }
            }
        )
        
        # Store and persist the agent ID
        self._agent_id = agent.agent_id
        self._save_config()
        
        return AgentConfig(
            agent_id=agent.agent_id,
            name=name,
            voice_id=self.voice_id,
            webhook_url=self.webhook_url,
            created_at=datetime.utcnow().isoformat() + "Z"
        )
    
    def get_agent_status(self) -> Dict[str, Any]:
        """
        Check if an agent is configured and retrieve its status.
        
        Returns:
            Dict with agent status information
        """
        if not self._agent_id:
            return {
                "configured": False,
                "agent_id": None,
                "message": "No agent configured. Call POST /voice/agent/setup to create one."
            }
        
        try:
            agent = self.client.conversational_ai.agents.get(agent_id=self._agent_id)
            return {
                "configured": True,
                "agent_id": self._agent_id,
                "name": agent.name if hasattr(agent, 'name') else "Oncology Triage Agent",
                "voice_id": self.voice_id,
                "webhook_url": self.webhook_url
            }
        except Exception as e:
            return {
                "configured": False,
                "agent_id": self._agent_id,
                "error": str(e),
                "message": "Agent ID is set but agent could not be retrieved."
            }
    
    def update_agent_prompt(self, questions: List[str], patient_id: str) -> None:
        """
        Update the agent's system prompt with new questions.
        
        Args:
            questions: List of questions to inject
            patient_id: The patient ID to inject into the prompt
        """
        if not self._agent_id:
            raise ValueError("No agent configured. Call create_agent() first.")
        
        # Format questions for injection
        questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        
        # Create the updated prompt
        updated_prompt = SYSTEM_PROMPT_TEMPLATE.replace("{{questions_to_ask}}", questions_text)
        updated_prompt = updated_prompt.replace("{{patient_id}}", patient_id)
        
        # Update the agent's prompt
        self.client.conversational_ai.agents.update(
            agent_id=self._agent_id,
            conversation_config={
                "agent": {
                    "prompt": {
                        "prompt": updated_prompt
                    },
                    "first_message": "Hello, this is your oncology care team's triage line. I have some questions prepared for your check-in today. Before we begin, are you the patient, or are you calling on behalf of someone?",
                    "language": "en"
                },
                "tts": {
                    "voice_id": self.voice_id
                }
            }
        )
    
    def get_signed_url(
        self, 
        patient_id: str,
        questions: List[str],
        patient_id_override: Optional[str] = None
    ) -> SessionStartResult:
        """
        Get a signed URL for the ElevenLabs widget with dynamic question injection.
        
        This method:
        1. Updates the agent's prompt with the computed questions
        2. Gets a signed URL for the widget
        
        Args:
            patient_id: The patient ID for context
            questions: List of precomputed questions to inject
            patient_id_override: Optional override for the patient_id variable
            
        Returns:
            SessionStartResult with signed URL and session details
        """
        if not self._agent_id:
            raise ValueError("No agent configured. Call create_agent() first.")
        
        # Update the agent's prompt with the questions
        pid = patient_id_override or patient_id
        self.update_agent_prompt(questions, pid)
        
        # Get signed URL
        signed_url_response = self.client.conversational_ai.conversations.get_signed_url(
            agent_id=self._agent_id
        )
        
        return SessionStartResult(
            signed_url=signed_url_response.signed_url,
            agent_id=self._agent_id,
            patient_id=patient_id,
            questions=questions,
            expires_at=None  # ElevenLabs doesn't expose this in the response
        )


# ============================================================================
# Question Precomputation Logic
# ============================================================================

def compute_checkin_questions(patient_id: str, window_hours: int = 84) -> PrecomputedQuestions:
    """
    Analyze recent patient events and generate 5 targeted check-in questions.
    
    This function examines:
    - Worsening symptoms (trend analysis)
    - Post-treatment risk windows
    - Missed wellness check-ins
    - Symptom patterns and contradictions
    
    Args:
        patient_id: The patient to analyze
        window_hours: How far back to look (default ~3.5 days)
        
    Returns:
        PrecomputedQuestions with 5 prioritized questions and reasoning
    """
    questions = []
    reasoning = []
    
    # Get recent events
    recent_events = store.get_recent_events(patient_id, window_hours=window_hours)
    
    # Get patient profile for context
    profile = store.get_profile(patient_id)
    
    # Separate by type
    symptom_events = [e for e in recent_events if e.event_type == EventType.SYMPTOM]
    treatment_events = [e for e in recent_events if e.event_type == EventType.TREATMENT]
    wellness_events = [e for e in recent_events if e.event_type == EventType.WELLNESS]
    
    # 1. Check for worsening symptoms
    worsening_symptoms = []
    for event in symptom_events:
        if hasattr(event, 'measurements') and event.measurements:
            for m in event.measurements:
                if hasattr(m, 'trend') and m.trend == "worsening":
                    worsening_symptoms.append(m.name if hasattr(m, 'name') else "symptom")
                elif hasattr(m, 'severity') and m.severity and hasattr(m.severity, 'value'):
                    if m.severity.value and m.severity.value >= 6:
                        worsening_symptoms.append(m.name if hasattr(m, 'name') else "symptom")
    
    if worsening_symptoms:
        symptom_list = ", ".join(set(worsening_symptoms[:2]))
        questions.append(f"I noticed you recently reported {symptom_list}. How is that today - better, worse, or about the same?")
        reasoning.append(f"Recent symptom(s) marked as worsening or high severity: {symptom_list}")
    
    # 2. Check for post-treatment risk window (infusion < 7 days ago)
    now = datetime.utcnow()
    recent_treatment = None
    for event in treatment_events:
        try:
            from dateutil import parser as dateparser
            event_time = dateparser.parse(event.timestamp)
            if event_time.tzinfo:
                event_time = event_time.replace(tzinfo=None)
            days_ago = (now - event_time).days
            if days_ago <= 7:
                recent_treatment = event
                break
        except:
            continue
    
    if recent_treatment:
        treatment_name = recent_treatment.name if hasattr(recent_treatment, 'name') else "your treatment"
        questions.append(f"You had {treatment_name} recently. Any new side effects since then - nausea, fatigue, mouth sores, or anything unusual?")
        reasoning.append(f"Post-treatment risk window: {treatment_name} within last 7 days")
    
    # 3. Always ask about red-flag symptoms (mandatory safety screen)
    if len(questions) < 3:
        questions.append("Any fever, chills, or feeling like you might have an infection?")
        reasoning.append("Mandatory safety screen: febrile neutropenia risk in oncology patients")
    
    # 4. Check mood/anxiety if no recent wellness data
    if not wellness_events:
        questions.append("How have you been feeling emotionally? Any increased anxiety or low mood?")
        reasoning.append("No wellness check-in logged in recent window - assessing QoL")
    else:
        # Check if anxiety was high
        for event in wellness_events:
            if hasattr(event, 'anxiety') and event.anxiety and event.anxiety >= 6:
                questions.append("Last time we checked in, your anxiety was elevated. How are you feeling now?")
                reasoning.append(f"Previous wellness check showed anxiety level {event.anxiety}/10")
                break
    
    # 5. Open-ended catch-all (always include)
    questions.append("Is there anything else on your mind today - any symptoms, concerns, or questions?")
    reasoning.append("Open-ended prompt to catch unreported issues")
    
    # If we don't have enough questions, add generic ones
    generic_questions = [
        ("How's your energy level been? Any unusual fatigue?", "General fatigue screening for oncology patients"),
        ("Are you able to eat and drink normally?", "Nutrition and hydration assessment"),
        ("Any pain that's new or different from before?", "Pain assessment"),
        ("Have you been able to keep up with your daily activities?", "Functional status / ECOG assessment"),
    ]
    
    for q, r in generic_questions:
        if len(questions) >= 5:
            break
        if q not in questions:
            questions.append(q)
            reasoning.append(r)
    
    # Build context summary
    context_parts = []
    if profile:
        if profile.current_treatment and profile.current_treatment.regimen:
            context_parts.append(f"Current regimen: {profile.current_treatment.regimen}")
        if profile.ecog_score is not None:
            context_parts.append(f"ECOG: {profile.ecog_score}")
    context_parts.append(f"Events in window: {len(symptom_events)} symptoms, {len(treatment_events)} treatments, {len(wellness_events)} wellness")
    
    return PrecomputedQuestions(
        patient_id=patient_id,
        questions=questions[:5],
        reasoning=reasoning[:5],
        context_summary=" | ".join(context_parts) if context_parts else None
    )


# ============================================================================
# Module-level singleton
# ============================================================================

agent_manager = ElevenLabsAgentManager()

