from .schemas import PatientProfile, AgentSession, MeasurableDisease, CurrentTreatment, SmokingHistory, BaseEvent, SymptomEvent, WellnessEvent, TreatmentEvent, WorkflowResultEvent, EventType, EventSource
import uuid
import json
import os
import random
from datetime import datetime
from typing import List, Dict

DATA_FILE = "patient_data.json"

class PatientStore:
    def __init__(self):
        self._profiles: Dict[str, PatientProfile] = {}
        self._active_profile_id = "default"
        self._sessions: List[AgentSession] = [] 
        self._events: Dict[str, List[BaseEvent]] = {} # patient_id -> list of events
        self.load_data()

    def load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    data = json.load(f)
                    
                    # Load Profiles
                    for pid, pdata in data.get("profiles", {}).items():
                        self._profiles[pid] = PatientProfile(**pdata)
                    
                    # Load Sessions
                    self._sessions = [AgentSession(**s) for s in data.get("sessions", [])]
                    
                    # Load Events
                    for pid, events in data.get("events", {}).items():
                        self._events[pid] = []
                        for e in events:
                            if e["event_type"] == EventType.SYMPTOM:
                                self._events[pid].append(SymptomEvent(**e))
                            elif e["event_type"] == EventType.WELLNESS:
                                self._events[pid].append(WellnessEvent(**e))
                            elif e["event_type"] == EventType.TREATMENT:
                                self._events[pid].append(TreatmentEvent(**e))
                            elif e["event_type"] == EventType.WORKFLOW_RESULT:
                                self._events[pid].append(WorkflowResultEvent(**e))
                            else:
                                self._events[pid].append(BaseEvent(**e))
                    
                    # Load Active ID
                    self._active_profile_id = data.get("active_profile_id", "default")
            except Exception as e:
                print(f"Error loading data: {e}")
        else:
            # Create default if no file exists
            self.create_new_profile("John Doe", is_default=True)

    def save_data(self):
        events_dict = {}
        for pid, events in self._events.items():
            events_dict[pid] = [e.dict() for e in events]

        data = {
            "profiles": {pid: p.dict() for pid, p in self._profiles.items()},
            "sessions": [s.dict() for s in self._sessions],
            "events": events_dict,
            "active_profile_id": self._active_profile_id
        }
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def list_profiles(self) -> List[PatientProfile]:
        return list(self._profiles.values())

    def switch_profile(self, profile_id: str):
        if profile_id in self._profiles:
            self._active_profile_id = profile_id
            self.save_data()
            return self._profiles[profile_id]
        return None

    def delete_profile(self, profile_id: str):
        if profile_id in self._profiles:
            del self._profiles[profile_id]
            if profile_id in self._events:
                del self._events[profile_id]
            
            # If we deleted the active profile, switch to another one if available
            if self._active_profile_id == profile_id:
                if len(self._profiles) > 0:
                    self._active_profile_id = list(self._profiles.keys())[0]
                else:
                    # Create a default if we deleted the last one
                    self.create_new_profile("John Doe", is_default=True)
            
            self.save_data()
            return True
        return False

    def create_new_profile(self, name: str, is_default=False) -> PatientProfile:
        new_id = "default" if is_default else str(uuid.uuid4())
        
        # Generate rich mock data
        cancer_types = ["Lung Adenocarcinoma", "Breast Invasive Ductal Carcinoma", "Colorectal Adenocarcinoma", "Pancreatic Ductal Adenocarcinoma"]
        regimens = ["Carboplatin + Pemetrexed", "AC-T (Doxorubicin + Cyclophosphamide -> Paclitaxel)", "FOLFOX", "Gemcitabine + Nab-Paclitaxel"]
        
        cancer_type = random.choice(cancer_types)
        regimen = random.choice(regimens)
        
        profile = PatientProfile(
            id=new_id,
            name=name,
            age=random.randint(45, 85),
            gender=random.choice(["Male", "Female"]),
            race=random.choice(["Caucasian", "African American", "Asian", "Hispanic"]),
            height=f"{random.randint(5, 6)}'{random.randint(0, 11)}\"",
            weight=f"{random.randint(130, 220)} lbs",
            city="Boston",
            state="MA",
            
            # Cancer Info
            cancer_type=cancer_type,
            diagnosis_date="2024-01-15",
            first_occurrence=True,
            stage=random.choice(["IIB", "IIIA", "IIIB", "IV"]),
            measurable_disease=MeasurableDisease(
                is_measurable=True, 
                description=f"Primary mass in {random.choice(['right upper lobe', 'left breast', 'sigmoid colon', 'pancreatic head'])}, approx {random.randint(2, 6)}cm"
            ),
            tumor_markers_found=["CEA", "CA-125"] if "Colorectal" in cancer_type else ["CEA", "PD-L1 > 50%"],
            tumor_markers_ruled_out=["KRAS"] if "Colorectal" in cancer_type else ["EGFR", "ALK"],
            
            # History
            family_history="Father: Lung Cancer (Smoker)\nMother: No cancer history",
            prior_therapies=[],
            current_treatment=CurrentTreatment(is_active=True, regimen=regimen),
            ecog_score=random.randint(0, 2),
            
            # Lifestyle
            smoking_history=SmokingHistory(pack_years=random.randint(0, 40), quit_date="2020-01-01"),
            alcohol_consumption="Occasional social drinker",
            
            # Prefs
            concerns="Worried about fatigue affecting work.",
            prognosis_preference="neutral",
            medical_records_text=f"Pathology confirmed {cancer_type}. Patient initiated on {regimen}. Tolerating well so far."
        )
        
        self._profiles[new_id] = profile
        self._active_profile_id = new_id
        # Init events list
        self._events[new_id] = []
        self.save_data()
        return profile

    def save_profile(self, profile: PatientProfile):
        self._profiles[profile.id] = profile
        # If we are saving the currently active profile, or this is a new one we want active
        if self._active_profile_id == profile.id:
            self._active_profile_id = profile.id
        if profile.id not in self._events:
            self._events[profile.id] = []
        self.save_data()
        return profile

    def get_profile(self, profile_id: str) -> PatientProfile:
        return self._profiles.get(profile_id)
    
    def get_active_profile(self) -> PatientProfile:
        return self._profiles.get(self._active_profile_id)

    def create_session(self, agent_type: str, transcript: str, analysis: dict) -> AgentSession:
        session_id = str(uuid.uuid4())
        session = AgentSession(
            id=session_id,
            agent_type=agent_type,
            transcript=transcript,
            analysis=analysis,
            created_at=datetime.now().isoformat()
        )
        self._sessions.append(session)
        self.save_data()
        return session

    def get_sessions(self):
        return self._sessions

    # Event Methods
    def add_event(self, event_data: dict) -> BaseEvent:
        patient_id = event_data.get("patient_id")
        if not patient_id:
            raise ValueError("Patient ID required")
        
        # Ensure list exists
        if patient_id not in self._events:
            self._events[patient_id] = []

        # Create typed event
        if event_data.get("event_type") == EventType.SYMPTOM:
            event = SymptomEvent(**event_data)
        elif event_data.get("event_type") == EventType.WELLNESS:
            event = WellnessEvent(**event_data)
        elif event_data.get("event_type") == EventType.TREATMENT:
            event = TreatmentEvent(**event_data)
        elif event_data.get("event_type") == EventType.WORKFLOW_RESULT:
            event = WorkflowResultEvent(**event_data)
        else:
            event = BaseEvent(**event_data)
            
        self._events[patient_id].append(event)
        self.save_data()
        return event

    def get_events(self, patient_id: str) -> List[BaseEvent]:
        # Sort by timestamp desc
        events = self._events.get(patient_id, [])
        return sorted(events, key=lambda x: x.timestamp, reverse=True)

    def delete_event(self, event_id: str):
        for pid, events in self._events.items():
            for i, event in enumerate(events):
                if event.id == event_id:
                    self._events[pid].pop(i)
                    self.save_data()
                    return True
        return False

# Global instance
store = PatientStore()
