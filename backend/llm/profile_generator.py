"""
LLM-based Patient Profile Generator
-----------------------------------
Uses Anthropic Claude to generate realistic patient profiles and event histories
from free-text descriptions.
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None

from schemas import (
    PatientProfile, SymptomEvent, WellnessEvent, TreatmentEvent, LifestyleEvent,
    EventType, EventSource, MeasurableDisease, CurrentTreatment, SmokingHistory,
    SymptomMeasurement, Severity, LifestyleCategory
)

# Load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed, skip .env loading
    pass

# Initialize Anthropic client (only if available)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
client = None
if ANTHROPIC_AVAILABLE and ANTHROPIC_API_KEY:
    client = Anthropic(api_key=ANTHROPIC_API_KEY)


def generate_patient_profile_and_events(
    description: str,
    name: Optional[str] = None,
    months_of_history: int = 6
) -> Tuple[PatientProfile, List]:
    """
    Generate a PatientProfile and realistic event history from a text description.
    
    Args:
        description: Free-text description of the patient (diagnosis, stage, symptoms, etc.)
        name: Optional patient name (if not provided, will be generated)
        months_of_history: How many months of historical events to generate
        
    Returns:
        Tuple of (PatientProfile, List[BaseEvent])
    """
    global client
    
    if not ANTHROPIC_AVAILABLE:
        raise ValueError("Anthropic package not installed. Install with: pip install anthropic")
    
    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required. Set it in a .env file or export it.")
        client = Anthropic(api_key=api_key)
    
    # Generate a unique patient ID
    patient_id = str(uuid.uuid4())
    
    # Calculate date range for events
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months_of_history * 30)
    
    # Build the prompt
    prompt = f"""You are a medical data generator for an oncology remote patient monitoring system.

Given this patient description:
"{description}"

Generate a realistic patient profile and {months_of_history} months of clinical event history.

Return ONLY valid JSON in this exact structure:
{{
  "profile": {{
    "id": "{patient_id}",
    "name": "<patient name>",
    "age": <integer 30-90>,
    "gender": "<Male|Female|Other>",
    "race": "<optional>",
    "height": "<e.g., 5'10\\\">",
    "weight": "<e.g., 150 lbs>",
    "city": "<city name>",
    "state": "<state abbreviation>",
    "cancer_type": "<specific cancer type>",
    "diagnosis_date": "<YYYY-MM-DD>",
    "first_occurrence": <true|false>,
    "stage": "<e.g., IIB, IIIA, IV>",
    "measurable_disease": {{
      "is_measurable": <true|false>,
      "description": "<if measurable, describe>"
    }},
    "tumor_markers_found": ["<marker1>", "<marker2>"],
    "tumor_markers_ruled_out": ["<marker1>"],
    "family_history": "<text description>",
    "prior_therapies": [
      {{
        "regimen": "<treatment name>",
        "start_date": "<YYYY-MM-DD>",
        "end_date": "<YYYY-MM-DD>"
      }}
    ],
    "current_treatment": {{
      "is_active": <true|false>,
      "regimen": "<current regimen if active>"
    }},
    "ecog_score": <0-4>,
    "smoking_history": {{
      "pack_years": <float>,
      "quit_date": "<YYYY-MM-DD or null>"
    }},
    "alcohol_consumption": "<description>",
    "concerns": "<patient concerns>",
    "prognosis_preference": "<show_stats|avoid_stats|neutral>",
    "medical_records_text": "<summary text>"
  }},
  "events": [
    {{
      "event_type": "symptom|wellness|treatment",
      "timestamp": "<ISO-8601 datetime>",
      "source": "manual",
      "patient_id": "{patient_id}",
      "id": "<uuid>",
      // For symptom events:
      "measurements": [
        {{
          "name": "<symptom name>",
          "severity": {{"value": <0-10>, "scale": "0_10"}},
          "trend": "<worsening|improving|stable>",
          "rawAnswer": "<optional>"
        }}
      ],
      // For wellness events:
      "mood": <1-5>,
      "anxiety": <0-10>,
      "notes": "<optional>",
      // For treatment events:
      "name": "<treatment name>",
      "description": "<optional>",
      // For interval treatments (treatment courses):
      "start_timestamp": "<ISO-8601 or null>",
      "end_timestamp": "<ISO-8601 or null>"
    }}
  ]
}}

Requirements:
1. Make the profile medically realistic and consistent with the description
2. Generate events from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}
3. For treatments: create both point-in-time events (single infusions) and interval events (treatment courses with start/end dates)
4. Symptom events should correlate temporally with treatments (e.g., nausea/fatigue after chemo)
5. Include wellness check-ins roughly weekly
6. Treatment intervals should be realistic (e.g., 2-3 week cycles, 3-6 month courses)
7. All timestamps must be ISO-8601 format
8. Generate at least 10-20 events total across the {months_of_history} month period
9. Make symptom severity values realistic (typically 2-7 for ongoing symptoms, spikes up to 8-9 after treatments)

Return ONLY the JSON, no markdown formatting, no code blocks."""

    try:
        # Call Anthropic API
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        # Extract JSON from response
        response_text = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        # Parse JSON
        data = json.loads(response_text)
        
        # Validate and create PatientProfile
        profile_data = data["profile"]
        if name:
            profile_data["name"] = name
        
        profile = PatientProfile(**profile_data)
        
        # Validate and create events
        events = []
        for event_data in data["events"]:
            event_type = event_data.get("event_type")
            
            # Ensure required fields
            if "id" not in event_data:
                event_data["id"] = str(uuid.uuid4())
            event_data["patient_id"] = patient_id
            event_data["source"] = EventSource.MANUAL
            event_data["confidence"] = 1.0
            event_data["derived_from"] = []
            event_data["schema_version"] = "1.0"
            
            if event_type == "symptom":
                # Ensure measurements structure
                if "measurements" not in event_data:
                    # Convert legacy format if needed
                    if "symptom_name" in event_data:
                        event_data["measurements"] = [{
                            "name": event_data["symptom_name"],
                            "severity": {"value": event_data.get("severity"), "scale": "0_10"},
                            "trend": event_data.get("trend", "stable")
                        }]
                event = SymptomEvent(**event_data)
            elif event_type == "wellness":
                event = WellnessEvent(**event_data)
            elif event_type == "treatment":
                event = TreatmentEvent(**event_data)
            else:
                # Skip unknown event types
                continue
            
            events.append(event)
        
        return profile, events
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}")
    except Exception as e:
        raise ValueError(f"Error generating patient profile: {e}")


def generate_events_from_prompt(
    patient_id: str,
    prompt: str
) -> List:
    """
    Generate events from a natural language prompt.
    
    This allows users to describe multiple events in plain language and have them
    parsed into structured event objects.
    
    Args:
        patient_id: The patient ID to associate events with
        prompt: Natural language description of events (e.g., "Last week I had headaches 
                on Monday and Wednesday, started a new diet on Tuesday...")
        
    Returns:
        List of event objects (SymptomEvent, WellnessEvent, TreatmentEvent, LifestyleEvent)
    """
    global client
    
    if not ANTHROPIC_AVAILABLE:
        raise ValueError("Anthropic package not installed. Install with: pip install anthropic")
    
    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required. Set it in a .env file or export it.")
        client = Anthropic(api_key=api_key)
    
    # Get current date for context
    today = datetime.now()
    
    # Build the prompt
    llm_prompt = f"""You are a medical data parser for a patient health tracking system.

Today's date is: {today.strftime('%Y-%m-%d')}

Parse the following natural language description into structured health events.
The patient is describing their recent health experiences:

"{prompt}"

Return ONLY valid JSON with an array of events in this exact structure:
{{
  "events": [
    {{
      "event_type": "symptom|wellness|treatment|lifestyle",
      "timestamp": "<ISO-8601 datetime>",
      "id": "<uuid>",
      
      // For symptom events:
      "measurements": [
        {{
          "name": "<symptom name>",
          "severity": {{"value": <0-10>, "scale": "0_10"}},
          "trend": "<worsening|improving|stable>",
          "rawAnswer": "<optional - original description>"
        }}
      ],
      
      // For wellness events:
      "mood": <1-5>,
      "anxiety": <0-10>,
      "notes": "<optional>",
      
      // For treatment events:
      "name": "<treatment/medication name>",
      "description": "<optional>",
      
      // For lifestyle events:
      "name": "<event name>",
      "category": "<diet|exercise|sleep|stress|travel|other>",
      "description": "<optional>",
      "notes": "<optional>"
    }}
  ]
}}

Guidelines:
1. Parse dates relative to today ({today.strftime('%Y-%m-%d')}). "Last Monday" means the most recent Monday before today.
2. "Yesterday", "today", "last week", etc. should be converted to specific ISO-8601 dates.
3. For symptoms without explicit severity, estimate based on descriptive language (mild=2-3, moderate=4-6, severe=7-9).
4. Categorize events appropriately:
   - Symptoms: headache, nausea, fatigue, pain, dizziness, etc.
   - Wellness: mood, anxiety, general wellbeing check-ins
   - Treatment: medications, therapies, doctor visits, procedures
   - Lifestyle: diet changes, exercise, sleep patterns, stress events, travel
5. Generate a unique UUID for each event's id field.
6. If multiple events are described, create separate event objects for each.
7. Be thorough - extract ALL events mentioned in the description.

Return ONLY the JSON, no markdown formatting, no code blocks."""

    try:
        # Call Anthropic API
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[
                {
                    "role": "user",
                    "content": llm_prompt
                }
            ]
        )
        
        # Extract JSON from response
        response_text = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        # Parse JSON
        data = json.loads(response_text)
        
        # Validate and create events
        events = []
        for event_data in data["events"]:
            event_type = event_data.get("event_type")
            
            # Ensure required fields
            if "id" not in event_data:
                event_data["id"] = str(uuid.uuid4())
            event_data["patient_id"] = patient_id
            event_data["source"] = EventSource.MANUAL
            event_data["confidence"] = 0.9  # Slightly lower confidence for LLM-parsed events
            event_data["derived_from"] = []
            event_data["schema_version"] = "1.0"
            
            if event_type == "symptom":
                # Ensure measurements structure
                if "measurements" not in event_data:
                    if "symptom_name" in event_data:
                        event_data["measurements"] = [{
                            "name": event_data["symptom_name"],
                            "severity": {"value": event_data.get("severity"), "scale": "0_10"},
                            "trend": event_data.get("trend", "stable")
                        }]
                event = SymptomEvent(**event_data)
            elif event_type == "wellness":
                event = WellnessEvent(**event_data)
            elif event_type == "treatment":
                event = TreatmentEvent(**event_data)
            elif event_type == "lifestyle":
                event = LifestyleEvent(**event_data)
            else:
                # Skip unknown event types
                continue
            
            events.append(event)
        
        return events
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}")
    except Exception as e:
        raise ValueError(f"Error generating events from prompt: {e}")

