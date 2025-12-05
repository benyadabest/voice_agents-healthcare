from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import date

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
