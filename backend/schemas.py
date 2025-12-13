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

class EventSource(str, Enum):
    MANUAL = "manual"
    VOICE = "voice"
    PORTAL = "portal"
    FHIR = "fhir"
    PDF = "pdf"

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

class WorkflowResultEvent(BaseEvent):
    event_type: EventType = EventType.WORKFLOW_RESULT
    workflow_name: str
    route: Literal["green", "yellow", "red"]
    patient_summary: Optional[str] = None
    clinician_summary: Optional[str] = None
    structured_payload: Optional[Dict[str, Any]] = None
    
    # Operational Safety Flags (Inline Gating)
    safety_flags: List[str] = Field(default_factory=list)

    # 🔑 Embedded signal layer
    signals: List[DerivedSignal] = Field(default_factory=list)
