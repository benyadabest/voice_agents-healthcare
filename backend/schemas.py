from typing import List, Optional, Any, Dict, Literal
from pydantic import BaseModel, Field
from datetime import date
from enum import Enum

# Sub-models for structured fields

class MeasurableDisease(BaseModel):
    is_measurable: bool
    description: Optional[str] = None

class PriorTherapy(BaseModel):
    regimen: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CurrentTreatment(BaseModel):
    is_active: bool
    regimen: Optional[str] = None

class SmokingHistory(BaseModel):
    pack_years: Optional[float] = 0.0
    quit_date: Optional[str] = None

class PatientProfile(BaseModel):
    # Core Demographics
    id: Optional[str] = "default" # Single profile for now, but good to have ID
    name: str
    age: int
    gender: str
    race: Optional[str] = None
    height: Optional[str] = None # e.g. "5'10\"" or cm
    weight: Optional[str] = None # e.g. "150 lbs" or kg
    city: Optional[str] = None
    state: Optional[str] = None

    # Cancer Information
    cancer_type: str
    diagnosis_date: Optional[str] = None
    first_occurrence: bool = True
    stage: Optional[str] = None
    measurable_disease: MeasurableDisease = MeasurableDisease(is_measurable=False)
    tumor_markers_found: List[str] = []
    tumor_markers_ruled_out: List[str] = []

    # Medical History
    family_history: Optional[str] = None
    prior_therapies: List[PriorTherapy] = []
    current_treatment: CurrentTreatment = CurrentTreatment(is_active=False)
    ecog_score: Optional[int] = None

    # Lifestyle
    smoking_history: Optional[SmokingHistory] = None
    alcohol_consumption: Optional[str] = None

    # Preferences & Concerns
    concerns: Optional[str] = None # "What's on your mind?"
    prognosis_preference: str = "neutral" # show_stats, avoid_stats, neutral

    # Attached Data
    medical_records_text: Optional[str] = None

# Agent Session Models

class SymptomObservation(BaseModel):
    name: str
    severity_0_10: Optional[int] = None
    onset_date: Optional[str] = None
    trend: Optional[str] = None # worsening, improving, stable
    location: Optional[str] = None
    associated_symptoms: List[str] = []
    functional_impact: Optional[str] = None
    onset_relative_to_event: Optional[str] = None

class PossibleRelationship(BaseModel):
    symptom: str
    related_to: str
    related_event_id: Optional[str] = None
    relationship_type: str # temporal_association, known_side_effect

class SafetyFlags(BaseModel):
    red_flag_present: bool
    recommendation_level: str # green, yellow, red
    
class AgentAnalysis(BaseModel):
    event_type: str # patient_initiated_checkin, ai_initiated_checkin, wellness_checkin
    timestamp: str
    chief_complaint: Optional[str] = None
    symptom_observations: List[SymptomObservation] = []
    possible_relationships: List[PossibleRelationship] = []
    safety_flags: Optional[SafetyFlags] = None
    # For wellness checkin
    mood: Optional[str] = None
    goals: Optional[str] = None
    
class AgentSession(BaseModel):
    id: str
    agent_type: str # patient, ai, wellness
    transcript: str
    analysis: Optional[AgentAnalysis] = None
    created_at: str

# Signal Definitions
SignalType = Literal[
    "symptom_delta",
    "trend",
    "persistence",
    "adherence_gap",
    "risk_window",
    "new_data",
    "contradiction"
]

SignalSeverity = Literal["low", "medium", "high"]

class SignalEvidence(BaseModel):
    event_id: str = Field(..., description="UUID of source event")
    field: str = Field(..., description="Dot-path into source event")
    value: Optional[object] = Field(
        None, description="Value used in signal derivation"
    )

class DerivedSignal(BaseModel):
    signal_type: SignalType
    title: str
    severity: SignalSeverity
    summary: str

    # Optional but very useful
    window_start: Optional[str] = Field(
        None, description="ISO-8601 window start"
    )
    window_end: Optional[str] = Field(
        None, description="ISO-8601 window end"
    )

    evidence: List[SignalEvidence] = Field(
        default_factory=list,
        description="Pointers to raw events used to derive this signal"
    )

    action_prompt: Optional[str] = Field(
        None,
        description="Suggested follow-up question or clinical action"
    )

# Timeline Event Models

class EventType(str, Enum):
    SYMPTOM = "symptom"
    WELLNESS = "wellness"
    TREATMENT = "treatment"
    WORKFLOW_RESULT = "workflow_result"
    LIFESTYLE = "lifestyle"

class LifestyleCategory(str, Enum):
    """Categories for lifestyle events."""
    DIET = "diet"
    EXERCISE = "exercise"
    SLEEP = "sleep"
    STRESS = "stress"
    TRAVEL = "travel"
    OTHER = "other"

class EventSource(str, Enum):
    MANUAL = "manual"
    VOICE = "voice"
    PORTAL = "portal"
    FHIR = "fhir"
    PDF = "pdf"

class TriageRoute(str, Enum):
    """Triage routing decision for patient encounters."""
    GREEN = "green"   # Self-manageable, no immediate action needed
    YELLOW = "yellow" # Needs clinician review within 24-48h
    RED = "red"       # Urgent escalation required

class TaskUrgency(str, Enum):
    """Urgency level for follow-up tasks."""
    ROUTINE = "routine"  # Review within 1 week
    URGENT = "urgent"    # Review within 24-48h
    STAT = "stat"        # Immediate attention required

class TaskStatus(str, Enum):
    """Status of a follow-up task."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class FollowupTask(BaseModel):
    """
    A follow-up task created by the triage agent for clinician review.
    Used when routing is 'yellow' or requires human attention.
    """
    id: str = Field(..., description="Unique task identifier")
    patient_id: str = Field(..., description="Patient this task relates to")
    urgency: TaskUrgency = Field(default=TaskUrgency.ROUTINE, description="How urgently this needs review")
    summary: str = Field(..., description="Brief summary of the issue requiring follow-up")
    context: Optional[str] = Field(None, description="Additional context for the clinician")
    triggered_by: Optional[str] = Field(None, description="Event or assessment ID that triggered this task")
    assigned_to: Optional[str] = Field(None, description="Clinician ID if assigned")
    created_at: str = Field(..., description="ISO-8601 timestamp when task was created")
    status: TaskStatus = Field(default=TaskStatus.PENDING, description="Current task status")

class BaseEvent(BaseModel):
    id: str
    patient_id: str
    timestamp: str # ISO
    event_type: EventType
    source: EventSource = EventSource.MANUAL
    confidence: Optional[float] = 1.0
    derived_from: List[str] = [] # list of event IDs
    schema_version: str = "1.0"
    correlation_id: Optional[str] = None

# New Structures for Symptom Measurements
class Severity(BaseModel):
    value: Optional[int] = None # 0-10
    scale: Optional[str] = "0_10"
    label: Optional[str] = None # "mild", "moderate", "severe"

class Frequency(BaseModel):
    valuePerDay: Optional[int] = None
    bucket: Optional[str] = None # "rare", "occasional", "frequent", "constant"

class SymptomMeasurement(BaseModel):
    name: str # e.g. "Headache"
    severity: Optional[Severity] = None
    frequency: Optional[Frequency] = None
    trend: Optional[str] = None
    rawAnswer: Optional[str] = None

class SymptomEvent(BaseEvent):
    event_type: EventType = EventType.SYMPTOM
    measurements: List[SymptomMeasurement] = []

class WellnessEvent(BaseEvent):
    event_type: EventType = EventType.WELLNESS
    mood: Optional[int] = None # 1-5
    anxiety: Optional[int] = None # 0-10
    notes: Optional[str] = None

class TreatmentEvent(BaseEvent):
    event_type: EventType = EventType.TREATMENT
    name: str
    description: Optional[str] = None
    # date field removed, relying on BaseEvent.timestamp for ISO datetime
    # Interval support: for treatment courses (e.g., chemo cycles), use start/end timestamps
    # For point-in-time treatments (single infusion), only timestamp is set
    start_timestamp: Optional[str] = None  # ISO-8601 start of treatment interval
    end_timestamp: Optional[str] = None    # ISO-8601 end of treatment interval

class WorkflowResultEvent(BaseEvent):
    """
    Operational output of a clinical workflow (e.g., triage).
    This is the auditable artifact that records routing decisions.
    """
    event_type: EventType = EventType.WORKFLOW_RESULT
    workflow_name: str = Field(..., description="Name of the workflow, e.g., 'symptom_triage'")
    route: TriageRoute = Field(..., description="Final triage routing decision")
    patient_summary: Optional[str] = Field(None, description="Patient-facing explanation of the result")
    clinician_summary: Optional[str] = Field(None, description="Clinician-facing technical summary")
    
    # What triggered escalation (if route is yellow/red)
    escalation_trigger: Optional[str] = Field(None, description="The specific criteria or symptom that triggered escalation")
    
    # Operational Safety Flags
    safety_flags: List[str] = Field(default_factory=list, description="List of identified red flags or safety concerns")
    
    # Confidence and Metadata
    triage_confidence: Optional[float] = Field(None, description="Model confidence in the routing decision (0-1)")
    structured_payload: Optional[Dict[str, Any]] = Field(None, description="Additional technical metadata")

    # 🔑 Embedded signal layer
    signals: List[DerivedSignal] = Field(default_factory=list, description="Clinical signals used to derive this result")

class LifestyleEvent(BaseEvent):
    """
    Lifestyle events track diet, exercise, sleep, stress, travel, and other life events
    that may correlate with symptoms or wellness.
    """
    event_type: EventType = EventType.LIFESTYLE
    name: str = Field(..., description="Name/title of the lifestyle event")
    category: LifestyleCategory = Field(default=LifestyleCategory.OTHER, description="Category of lifestyle event")
    description: Optional[str] = Field(None, description="Detailed description")
    notes: Optional[str] = Field(None, description="Additional notes")

# Agent Webhook Schemas

class ToolCallRequest(BaseModel):
    """Request format for executing a tool via webhook."""
    tool_name: str = Field(..., description="The name of the tool to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="The arguments to pass to the tool")

class ToolCallResponse(BaseModel):
    """Response format for a tool execution."""
    tool_name: str
    result: Any
    status: str = "success" # success, error
    error: Optional[str] = None

# Annotation Models

class Annotation(BaseModel):
    """
    Annotations allow users to add notes to time ranges on the timeline/charts.
    These are independent of events and mark periods of interest (e.g., vacation, hospital stay).
    """
    id: str = Field(..., description="Unique annotation identifier")
    patient_id: str = Field(..., description="Patient this annotation belongs to")
    title: str = Field(..., description="Short title for the annotation")
    start_timestamp: str = Field(..., description="Start time (ISO-8601)")
    end_timestamp: str = Field(..., description="End time (ISO-8601)")
    text: Optional[str] = Field(None, description="Additional notes/description")
    color: str = Field("#3b82f6", description="Color for the annotation marker (hex)")
    created_at: str = Field(..., description="ISO-8601 timestamp when annotation was created")

# Saved View Models

class ViewFilters(BaseModel):
    """Filter configuration for a saved view."""
    symptoms: List[str] = Field(default_factory=list, description="List of symptom names to show (empty = all)")
    treatments: List[str] = Field(default_factory=list, description="List of treatment names to show (empty = all)")
    wellness: List[str] = Field(default_factory=list, description="List of wellness metrics to show (empty = all)")
    lifestyle: List[str] = Field(default_factory=list, description="List of lifestyle categories to show (empty = all)")
    show_all_symptoms: bool = True
    show_all_treatments: bool = True
    show_all_wellness: bool = True
    show_all_lifestyle: bool = True

class SavedView(BaseModel):
    """
    A saved view configuration that users can recall to quickly apply
    a set of filters to the timeline/charts.
    """
    id: str = Field(..., description="Unique view identifier")
    patient_id: str = Field(..., description="Patient this view belongs to")
    name: str = Field(..., description="User-friendly name for the view")
    filters: ViewFilters = Field(default_factory=ViewFilters, description="Filter configuration")
    chart_type: str = Field("line", description="Chart type preference (line, area, bar)")
    created_at: str = Field(..., description="ISO-8601 timestamp when view was created")


