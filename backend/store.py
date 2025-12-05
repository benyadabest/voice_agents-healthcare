from .schemas import PatientProfile, AgentSession
import uuid
from datetime import datetime

# In-memory storage
# For this simulation, we'll just keep a single active profile or a dictionary by ID.
# Since the requirement is "Developer Console", likely working on one patient context at a time.
# We'll use a simple dictionary where key is profile_id.

class PatientStore:
    def __init__(self):
        self._profiles = {}
        self._active_profile_id = "default"
        self._sessions = [] # List of AgentSession

    def save_profile(self, profile: PatientProfile):
        self._profiles[profile.id] = profile
        self._active_profile_id = profile.id
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
        return session

    def get_sessions(self):
        return self._sessions

# Global instance
store = PatientStore()
