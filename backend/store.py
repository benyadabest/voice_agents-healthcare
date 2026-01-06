from schemas import (
    PatientProfile, AgentSession, MeasurableDisease, CurrentTreatment, SmokingHistory,
    BaseEvent, SymptomEvent, WellnessEvent, TreatmentEvent, WorkflowResultEvent, LifestyleEvent,
    EventType, EventSource, FollowupTask, TaskStatus,
    Annotation, SavedView, ViewFilters
)
import uuid
import json
import os
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dateutil import parser as dateparser

DATA_FILE = "patient_data.json"

class PatientStore:
    def __init__(self):
        self._profiles: Dict[str, PatientProfile] = {}
        self._active_profile_id = "default"
        self._sessions: List[AgentSession] = [] 
        self._events: Dict[str, List[BaseEvent]] = {} # patient_id -> list of events
        self._followup_tasks: Dict[str, List[FollowupTask]] = {} # patient_id -> list of tasks (mocked/in-memory)
        self._annotations: Dict[str, List[Annotation]] = {} # patient_id -> list of annotations
        self._saved_views: Dict[str, List[SavedView]] = {} # patient_id -> list of saved views
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
                            elif e["event_type"] == EventType.LIFESTYLE:
                                self._events[pid].append(LifestyleEvent(**e))
                            else:
                                self._events[pid].append(BaseEvent(**e))
                    
                    # Load Annotations
                    for pid, annotations in data.get("annotations", {}).items():
                        self._annotations[pid] = [Annotation(**a) for a in annotations]
                    
                    # Load Saved Views
                    for pid, views in data.get("saved_views", {}).items():
                        self._saved_views[pid] = [SavedView(**v) for v in views]
                    
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

        annotations_dict = {}
        for pid, annotations in self._annotations.items():
            annotations_dict[pid] = [a.dict() for a in annotations]

        views_dict = {}
        for pid, views in self._saved_views.items():
            views_dict[pid] = [v.dict() for v in views]

        data = {
            "profiles": {pid: p.dict() for pid, p in self._profiles.items()},
            "sessions": [s.dict() for s in self._sessions],
            "events": events_dict,
            "annotations": annotations_dict,
            "saved_views": views_dict,
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

    def create_profile_with_events(self, profile: PatientProfile, events: List[BaseEvent]) -> PatientProfile:
        """
        Create a new profile and attach a list of events to it.
        Used for LLM-generated profiles.
        """
        self._profiles[profile.id] = profile
        self._active_profile_id = profile.id
        self._events[profile.id] = events
        self.save_data()
        return profile

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
        elif event_data.get("event_type") == EventType.LIFESTYLE:
            event = LifestyleEvent(**event_data)
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

    def get_recent_events(
        self, 
        patient_id: str, 
        window_hours: int = 168,  # Default 7 days
        event_types: Optional[List[EventType]] = None
    ) -> List[BaseEvent]:
        """
        Get events within a time window for trend detection.
        
        Args:
            patient_id: The patient to query events for
            window_hours: How far back to look (default 168 = 7 days)
            event_types: Optional filter for specific event types
            
        Returns:
            List of events within the window, sorted by timestamp (newest first)
        """
        events = self._events.get(patient_id, [])
        if not events:
            return []
        
        cutoff = datetime.utcnow() - timedelta(hours=window_hours)
        
        filtered = []
        for event in events:
            try:
                event_time = dateparser.parse(event.timestamp)
                # Make timezone-naive for comparison if needed
                if event_time.tzinfo is not None:
                    event_time = event_time.replace(tzinfo=None)
                if event_time >= cutoff:
                    if event_types is None or event.event_type in event_types:
                        filtered.append(event)
            except (ValueError, TypeError):
                # Skip events with invalid timestamps
                continue
        
        return sorted(filtered, key=lambda x: x.timestamp, reverse=True)

    # Followup Task Methods (Mocked - In-Memory Only)
    
    def add_followup_task(self, task: FollowupTask) -> FollowupTask:
        """
        Add a follow-up task for clinician review.
        Note: Currently mocked - tasks are in-memory only and not persisted.
        """
        patient_id = task.patient_id
        if patient_id not in self._followup_tasks:
            self._followup_tasks[patient_id] = []
        
        self._followup_tasks[patient_id].append(task)
        return task
    
    def get_followup_tasks(
        self, 
        patient_id: str, 
        status: Optional[TaskStatus] = None
    ) -> List[FollowupTask]:
        """
        Get follow-up tasks for a patient.
        
        Args:
            patient_id: The patient to query tasks for
            status: Optional filter by task status
            
        Returns:
            List of tasks, sorted by urgency (stat > urgent > routine)
        """
        tasks = self._followup_tasks.get(patient_id, [])
        
        if status is not None:
            tasks = [t for t in tasks if t.status == status]
        
        # Sort by urgency priority
        urgency_order = {"stat": 0, "urgent": 1, "routine": 2}
        return sorted(tasks, key=lambda t: urgency_order.get(t.urgency.value, 99))
    
    def update_task_status(self, task_id: str, new_status: TaskStatus) -> Optional[FollowupTask]:
        """Update the status of a follow-up task."""
        for patient_tasks in self._followup_tasks.values():
            for task in patient_tasks:
                if task.id == task_id:
                    task.status = new_status
                    return task
        return None

    # Annotation Methods
    
    def add_annotation(self, annotation: Annotation) -> Annotation:
        """Add an annotation to the store."""
        patient_id = annotation.patient_id
        if patient_id not in self._annotations:
            self._annotations[patient_id] = []
        
        self._annotations[patient_id].append(annotation)
        self.save_data()
        return annotation
    
    def get_annotations(self, patient_id: str) -> List[Annotation]:
        """Get all annotations for a patient."""
        return self._annotations.get(patient_id, [])
    
    def delete_annotation(self, annotation_id: str) -> bool:
        """Delete an annotation by ID."""
        for pid, annotations in self._annotations.items():
            for i, annotation in enumerate(annotations):
                if annotation.id == annotation_id:
                    self._annotations[pid].pop(i)
                    self.save_data()
                    return True
        return False

    # Saved View Methods
    
    def add_saved_view(self, view: SavedView) -> SavedView:
        """Add a saved view to the store."""
        patient_id = view.patient_id
        if patient_id not in self._saved_views:
            self._saved_views[patient_id] = []
        
        self._saved_views[patient_id].append(view)
        self.save_data()
        return view
    
    def get_saved_views(self, patient_id: str) -> List[SavedView]:
        """Get all saved views for a patient."""
        return self._saved_views.get(patient_id, [])
    
    def delete_saved_view(self, view_id: str) -> bool:
        """Delete a saved view by ID."""
        for pid, views in self._saved_views.items():
            for i, view in enumerate(views):
                if view.id == view_id:
                    self._saved_views[pid].pop(i)
                    self.save_data()
                    return True
        return False

# Global instance
store = PatientStore()
