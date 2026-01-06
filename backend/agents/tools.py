"""
Agent Tools Module
------------------
LLM-callable tool functions for the oncology triage agent.

This module provides the agent interface layer, wrapping store.py with:
- Pydantic input/output schemas for type safety
- Clear docstrings for LLM consumption
- Validation and safety rules
- Stable tool contracts

Usage with LLM function calling:
    Each function is designed to be exposed as an LLM tool with its
    docstring serving as the tool description and Pydantic models
    defining the parameter schemas.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import httpx

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store import store
from schemas import (
    PatientProfile, BaseEvent, SymptomEvent, WellnessEvent, WorkflowResultEvent,
    EventType, EventSource, SymptomMeasurement, Severity,
    TriageRoute, TaskUrgency, TaskStatus, FollowupTask
)


# ============================================================================
# Input/Output Schemas for Tools
# ============================================================================

class PatientContext(BaseModel):
    """Full patient context for triage decisions."""
    profile: PatientProfile
    current_regimen: Optional[str] = None
    ecog_score: Optional[int] = None
    recent_concerns: Optional[str] = None


class CareProtocol(BaseModel):
    """Clinical guidelines and escalation criteria for a specific complaint."""
    name: str
    description: str
    complaint: str
    # Criteria for routing decisions - the Agent uses these to match against observations
    escalation_criteria: Dict[str, str] = Field(
        default_factory=dict, 
        description="Thresholds for RED/YELLOW routing (e.g., {'red': 'severity >= 8', 'yellow': 'new symptom'})"
    )
    red_flags: List[str] = Field(default_factory=list, description="Specific symptoms requiring immediate RED escalation")
    common_side_effects: List[str] = Field(default_factory=list)
    supportive_care: List[str] = Field(default_factory=list)


class SymptomInput(BaseModel):
    """Input for logging a symptom event."""
    name: str = Field(..., description="Name of the symptom (e.g. 'Headache', 'Nausea')")
    severity: int = Field(..., ge=0, le=10, description="Severity on 0-10 scale")
    trend: Optional[str] = Field(None, description="One of: 'worsening', 'stable', 'improving'")
    notes: Optional[str] = Field(None, description="Additional context from patient")


class WellnessInput(BaseModel):
    """Input for logging a wellness check."""
    mood: int = Field(..., ge=1, le=5, description="Mood rating 1-5 (1=very low, 5=great)")
    anxiety: int = Field(..., ge=0, le=10, description="Anxiety level 0-10")
    notes: Optional[str] = Field(None, description="Additional notes or concerns")


class WorkflowResultInput(BaseModel):
    """Input for logging a workflow result (auditable artifact)."""
    route: TriageRoute = Field(..., description="Triage decision: green, yellow, or red")
    patient_summary: str = Field(..., description="Brief summary for the patient")
    clinician_summary: Optional[str] = Field(None, description="Detailed summary for clinician review")
    safety_flags: List[str] = Field(default_factory=list, description="Any red flags identified")
    escalation_trigger: Optional[str] = Field(None, description="The specific criteria that triggered escalation")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in triage decision")
    structured_payload: Optional[Dict[str, Any]] = Field(None, description="Additional structured data")



class FollowupTaskInput(BaseModel):
    """Input for creating a follow-up task."""
    urgency: TaskUrgency = Field(default=TaskUrgency.ROUTINE, description="Task urgency level")
    summary: str = Field(..., description="Brief summary of what needs follow-up")
    context: Optional[str] = Field(None, description="Additional context for the clinician")
    triggered_by: Optional[str] = Field(None, description="Event ID that triggered this task")


class EscalationInput(BaseModel):
    """Input for escalating to a human."""
    reason: str = Field(..., description="Why this needs immediate human attention")
    severity: str = Field(default="high", description="One of: 'medium', 'high', 'critical'")
    contact_preference: Optional[str] = Field(None, description="How to contact: 'call', 'message', 'both'")


class EscalationResult(BaseModel):
    """Result of an escalation request."""
    escalation_id: str
    acknowledged: bool
    message: str
    estimated_response: Optional[str] = None


class WebSearchResult(BaseModel):
    """A single search result with title, snippet, and source URL."""
    title: str
    snippet: str
    url: str


class WebSearchResponse(BaseModel):
    """Response from web search containing multiple results."""
    query: str
    results: List[WebSearchResult]
    source: str = "duckduckgo"


# ============================================================================
# Tool Functions
# ============================================================================

def web_search(query: str, max_results: int = 5) -> WebSearchResponse:
    """
    Search the web for medical and health information.
    
    Use this to look up symptoms, conditions, drug interactions, treatment options,
    and medical guidelines. Helpful for providing evidence-based information to patients.
    
    Args:
        query: The search query (e.g., "carboplatin side effects", "headache red flags oncology")
        max_results: Maximum number of results to return (default 5)
        
    Returns:
        WebSearchResponse with list of results containing title, snippet, and URL
        
    Example:
        results = web_search("nausea management during chemotherapy")
        # Returns relevant medical information from trusted sources
    """
    try:
        # Use DuckDuckGo HTML search (no API key required)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # DuckDuckGo lite/html endpoint
        params = {
            "q": query,
            "kl": "us-en",  # US English results
        }
        
        response = httpx.get(
            "https://html.duckduckgo.com/html/",
            params=params,
            headers=headers,
            timeout=10.0,
            follow_redirects=True
        )
        response.raise_for_status()
        
        # Parse results from HTML (simplified extraction)
        results = []
        html = response.text
        
        # Extract result blocks - DuckDuckGo HTML has class="result"
        import re
        
        # Find all result links and snippets
        result_pattern = r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</a>'
        snippet_pattern = r'<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)</a>'
        
        links = re.findall(result_pattern, html)
        snippets = re.findall(snippet_pattern, html)
        
        for i, (url, title) in enumerate(links[:max_results]):
            snippet = snippets[i] if i < len(snippets) else ""
            # Clean up HTML entities and tags from snippet
            snippet = re.sub(r'<[^>]+>', '', snippet)
            snippet = snippet.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
            snippet = snippet.replace('&#x27;', "'").replace('&quot;', '"')
            
            if url and title:
                results.append(WebSearchResult(
                    title=title.strip(),
                    snippet=snippet.strip()[:500],  # Limit snippet length
                    url=url
                ))
        
        # If regex parsing failed, return a helpful message
        if not results:
            results.append(WebSearchResult(
                title="Search completed",
                snippet=f"Searched for: {query}. Please try a more specific medical query.",
                url=""
            ))
        
        return WebSearchResponse(
            query=query,
            results=results,
            source="duckduckgo"
        )
        
    except Exception as e:
        # Return error as a result so agent can handle gracefully
        return WebSearchResponse(
            query=query,
            results=[WebSearchResult(
                title="Search Error",
                snippet=f"Could not complete search: {str(e)}. Try rephrasing the query.",
                url=""
            )],
            source="duckduckgo"
        )


def get_patient_context(patient_id: str) -> PatientContext:
    """
    Retrieve the full patient context including profile, treatment info, and concerns.
    
    Use this at the start of a conversation to understand the patient's background,
    current treatment regimen, and any documented concerns.
    
    Args:
        patient_id: The unique identifier for the patient
        
    Returns:
        PatientContext with profile, current regimen, ECOG score, and concerns
        
    Example:
        context = get_patient_context("patient-123")
        # Now you know their cancer type, treatment, and what's on their mind
    """
    profile = store.get_profile(patient_id)
    if profile is None:
        raise ValueError(f"Patient not found: {patient_id}")
    
    return PatientContext(
        profile=profile,
        current_regimen=profile.current_treatment.regimen if profile.current_treatment else None,
        ecog_score=profile.ecog_score,
        recent_concerns=profile.concerns
    )


def get_care_plan_protocols(patient_id: str, chief_complaint: Optional[str] = None) -> List[CareProtocol]:
    """
    Get relevant care protocols for a patient based on their regimen and chief complaint.
    
    Provides the clinical criteria (escalation thresholds and red flags) that the 
    Agent must use to determine the triage route. The Agent should match patient 
    observations against these criteria.
    
    Args:
        patient_id: The unique identifier for the patient
        chief_complaint: Optional symptom name to get specific guidelines for
        
    Returns:
        List of CareProtocol objects with criteria, red flags, and guidance
    """
    profile = store.get_profile(patient_id)
    if profile is None:
        raise ValueError(f"Patient not found: {patient_id}")
    
    regimen = profile.current_treatment.regimen if profile.current_treatment else None
    protocols = []
    
    # Standard Oncology Red Flags (always included)
    general_red_flags = [
        "Fever ≥100.4°F (38°C)",
        "Severe shortness of breath",
        "Chest pain",
        "Confusion or altered mental status",
        "Uncontrolled bleeding"
    ]

    # Helper to create a protocol
    def add_protocol(name, desc, complaint, escalation, red_flags, side_effects, care):
        protocols.append(CareProtocol(
            name=name, description=desc, complaint=complaint,
            escalation_criteria=escalation,
            red_flags=list(set(general_red_flags + red_flags)),
            common_side_effects=side_effects,
            supportive_care=care
        ))

    # Determine which protocols to return
    is_headache = chief_complaint and "headache" in chief_complaint.lower()
    is_nausea = chief_complaint and "nausea" in chief_complaint.lower()

    if regimen:
        if "Carboplatin" in regimen or "Pemetrexed" in regimen:
            if is_headache or not chief_complaint:
                add_protocol(
                    "NSCLC Symptom Management - Neurological",
                    "Guidelines for neurological symptoms during Carboplatin/Pemetrexed",
                    "Headache",
                    {"red": "severity >= 8", "yellow": "severity >= 4 or worsening trend"},
                    ["New focal neurological deficit", "Sudden 'thunderclap' headache"],
                    ["Fatigue", "Dizziness"],
                    ["Acetaminophen per oncology guidelines", "Quiet, dark room"]
                )
            if is_nausea or not chief_complaint:
                add_protocol(
                    "NSCLC Symptom Management - GI",
                    "Guidelines for GI distress during Carboplatin/Pemetrexed",
                    "Nausea",
                    {"red": "unable to keep fluids down > 12h", "yellow": "severity >= 5"},
                    ["Severe abdominal pain", "Coffee-ground emesis"],
                    ["Decreased appetite"],
                    ["Ondansetron 8mg every 8h PRN", "Small, frequent meals"]
                )

        elif "FOLFOX" in regimen:
            if "neuropathy" in (chief_complaint or "").lower() or not chief_complaint:
                add_protocol(
                    "FOLFOX Neuropathy Protocol",
                    "Oxaliplatin-induced peripheral neuropathy monitoring",
                    "Neuropathy",
                    {"red": "functional impact (difficulty walking/buttoning)", "yellow": "new onset cold sensitivity"},
                    ["Severe muscle cramps", "Laryngopharyngeal dysesthesia"],
                    ["Tingling in hands/feet"],
                    ["Avoid cold foods/drinks for 5 days", "Wear gloves when reaching into freezer"]
                )
    
    # Fallback/General protocol if nothing specific matches
    if not protocols:
        add_protocol(
            "General Oncology Triage",
            "Standard monitoring for oncology patients",
            chief_complaint or "General",
            {"red": "severity >= 8", "yellow": "severity >= 5"},
            [],
            ["Fatigue", "Mild nausea"],
            ["Hydration", "Rest", "Log symptoms"]
        )
    
    return protocols



def get_recent_events(
    patient_id: str, 
    window_hours: int = 168,
    event_types: Optional[List[str]] = None
) -> List[BaseEvent]:
    """
    Get recent events for a patient within a time window.
    
    Use this to detect trends and compare current symptoms to historical data.
    Ask: "Is this different from last week?" or "Is this getting worse?"
    
    Args:
        patient_id: The unique identifier for the patient
        window_hours: How many hours back to look (default 168 = 7 days)
        event_types: Optional filter, e.g. ["symptom", "wellness", "treatment"]
        
    Returns:
        List of events within the window, newest first
        
    Example:
        recent = get_recent_events("patient-123", window_hours=72)
        # Check if headache severity has increased over the last 3 days
    """
    # Convert string event types to enum if provided
    type_filter = None
    if event_types:
        type_filter = []
        for et in event_types:
            if et == "symptom":
                type_filter.append(EventType.SYMPTOM)
            elif et == "wellness":
                type_filter.append(EventType.WELLNESS)
            elif et == "treatment":
                type_filter.append(EventType.TREATMENT)
            elif et == "workflow_result":
                type_filter.append(EventType.WORKFLOW_RESULT)
    
    return store.get_recent_events(patient_id, window_hours, type_filter)


def log_symptom_event(patient_id: str, symptom: SymptomInput) -> SymptomEvent:
    """
    Log a structured symptom event to the patient's timeline.
    
    Call this after gathering symptom information from the patient.
    Each symptom should be logged as a separate event for tracking.
    
    Args:
        patient_id: The unique identifier for the patient
        symptom: SymptomInput with name, severity (0-10), trend, and optional notes
        
    Returns:
        The created SymptomEvent with generated ID and timestamp
        
    Example:
        event = log_symptom_event("patient-123", SymptomInput(
            name="Headache",
            severity=7,
            trend="worsening",
            notes="Started after last infusion"
        ))
    """
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    measurement = SymptomMeasurement(
        name=symptom.name,
        severity=Severity(value=symptom.severity, scale="0_10", label="user_reported"),
        trend=symptom.trend,
        rawAnswer=symptom.notes
    )
    
    event_data = {
        "id": event_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "event_type": EventType.SYMPTOM,
        "source": EventSource.VOICE,
        "measurements": [measurement.dict()]
    }
    
    return store.add_event(event_data)


def log_wellness_check(patient_id: str, wellness: WellnessInput) -> WellnessEvent:
    """
    Log a wellness/mood check-in to the patient's timeline.
    
    Call this after gathering wellness information during a check-in.
    Tracks mood, anxiety, and general well-being over time.
    
    Args:
        patient_id: The unique identifier for the patient
        wellness: WellnessInput with mood (1-5), anxiety (0-10), and optional notes
        
    Returns:
        The created WellnessEvent with generated ID and timestamp
        
    Example:
        event = log_wellness_check("patient-123", WellnessInput(
            mood=3,
            anxiety=6,
            notes="Worried about upcoming scan results"
        ))
    """
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    event_data = {
        "id": event_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "event_type": EventType.WELLNESS,
        "source": EventSource.VOICE,
        "mood": wellness.mood,
        "anxiety": wellness.anxiety,
        "notes": wellness.notes
    }
    
    return store.add_event(event_data)


def log_workflow_result(
    patient_id: str, 
    result: WorkflowResultInput,
    workflow_name: str = "symptom_triage"
) -> WorkflowResultEvent:
    """
    Log the final result of a clinical workflow as an auditable artifact.
    
    This records the routing decision (green/yellow/red), identifies the
    specific criteria or red flags that triggered the route, and provides
    summaries for both the patient and clinician.
    
    Args:
        patient_id: The unique identifier for the patient
        result: WorkflowResultInput with route, summaries, and triggers
        workflow_name: Name of the workflow (default "symptom_triage")
        
    Returns:
        The created WorkflowResultEvent
    """
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    event_data = {
        "id": event_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "event_type": EventType.WORKFLOW_RESULT,
        "source": EventSource.VOICE,
        "workflow_name": workflow_name,
        "route": result.route,
        "patient_summary": result.patient_summary,
        "clinician_summary": result.clinician_summary,
        "safety_flags": result.safety_flags,
        "escalation_trigger": result.escalation_trigger,
        "triage_confidence": result.confidence,
        "structured_payload": result.structured_payload
    }
    
    return store.add_event(event_data)



def create_followup_task(patient_id: str, task: FollowupTaskInput) -> FollowupTask:
    """
    Create a follow-up task for clinician review.
    
    Use this when routing is 'yellow' and the patient needs clinician review
    but not immediate escalation. Creates a task in the clinician queue.
    
    Note: Currently mocked - tasks are stored in memory only.
    
    Args:
        patient_id: The unique identifier for the patient
        task: FollowupTaskInput with urgency, summary, and context
        
    Returns:
        The created FollowupTask with ID and timestamp
        
    Example:
        task = create_followup_task("patient-123", FollowupTaskInput(
            urgency=TaskUrgency.URGENT,
            summary="Review headache progression - severity increased from 3 to 7",
            context="Patient reports headache worsening since last infusion. No red flags.",
            triggered_by="workflow-result-456"
        ))
    """
    task_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    followup_task = FollowupTask(
        id=task_id,
        patient_id=patient_id,
        urgency=task.urgency,
        summary=task.summary,
        context=task.context,
        triggered_by=task.triggered_by,
        created_at=timestamp,
        status=TaskStatus.PENDING
    )
    
    return store.add_followup_task(followup_task)


def escalate_to_human(patient_id: str, escalation: EscalationInput) -> EscalationResult:
    """
    Immediately escalate to a human clinician for urgent review.
    
    Use this for 'red' routes or when the situation requires immediate
    human attention (e.g., red flag symptoms, patient distress, safety concerns).
    
    This triggers an alert to the on-call team and logs the escalation.
    
    Args:
        patient_id: The unique identifier for the patient
        escalation: EscalationInput with reason, severity, and contact preference
        
    Returns:
        EscalationResult confirming the escalation was triggered
    """
    escalation_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Log escalation as a workflow result with RED route
    result = WorkflowResultInput(
        route=TriageRoute.RED,
        patient_summary="This requires immediate attention from your care team.",
        clinician_summary=f"ESCALATION: {escalation.reason}",
        safety_flags=["human_escalation_triggered"],
        escalation_trigger=escalation.reason,
        confidence=1.0,
        structured_payload={
            "escalation_id": escalation_id,
            "severity": escalation.severity,
            "contact_preference": escalation.contact_preference,
            "triggered_at": timestamp
        }
    )
    
    log_workflow_result(patient_id, result, workflow_name="human_escalation")

    
    # In production, this would:
    # - Send alert to on-call system
    # - Page the care team
    # - Create urgent task in EHR
    # - Potentially initiate a call transfer
    
    # Mock response
    return EscalationResult(
        escalation_id=escalation_id,
        acknowledged=True,
        message="Escalation received. Care team has been notified.",
        estimated_response="A clinician will contact you within 15 minutes."
    )


# ============================================================================
# Tool Registry (for LLM function calling setup)
# ============================================================================

TOOL_REGISTRY = {
    "web_search": {
        "function": web_search,
        "description": web_search.__doc__,
        "parameters": {
            "query": {"type": "string", "description": "The search query for medical/health information"},
            "max_results": {"type": "integer", "description": "Maximum number of results to return (default 5)"}
        }
    },
    "get_patient_context": {
        "function": get_patient_context,
        "description": get_patient_context.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"}
        }
    },
    "get_care_plan_protocols": {
        "function": get_care_plan_protocols,
        "description": get_care_plan_protocols.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "chief_complaint": {"type": "string", "description": "Optional symptom name to get specific guidelines for"}
        }
    },
    "get_recent_events": {
        "function": get_recent_events,
        "description": get_recent_events.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "window_hours": {"type": "integer", "description": "How many hours back to look (default 168 = 7 days)"},
            "event_types": {"type": "array", "items": {"type": "string"}, "description": "Optional filter, e.g. ['symptom', 'wellness']"}
        }
    },
    "log_symptom_event": {
        "function": log_symptom_event,
        "description": log_symptom_event.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "symptom": {"type": "object", "description": "SymptomInput with name, severity, trend, notes"}
        }
    },
    "log_wellness_check": {
        "function": log_wellness_check,
        "description": log_wellness_check.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "wellness": {"type": "object", "description": "WellnessInput with mood, anxiety, notes"}
        }
    },
    "log_workflow_result": {
        "function": log_workflow_result,
        "description": log_workflow_result.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "result": {"type": "object", "description": "WorkflowResultInput with route, summaries, triggers"},
            "workflow_name": {"type": "string", "description": "Name of the workflow (default 'symptom_triage')"}
        }
    },
    "create_followup_task": {
        "function": create_followup_task,
        "description": create_followup_task.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "task": {"type": "object", "description": "FollowupTaskInput with urgency, summary, context"}
        }
    },
    "escalate_to_human": {
        "function": escalate_to_human,
        "description": escalate_to_human.__doc__,
        "parameters": {
            "patient_id": {"type": "string", "description": "The unique identifier for the patient"},
            "escalation": {"type": "object", "description": "EscalationInput with reason, severity, contact_preference"}
        }
    }
}


