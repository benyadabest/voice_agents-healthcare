# Oncology Voice Agent & RPM Console

A developer-focused platform for prototyping and simulating voice-powered Remote Patient Monitoring (RPM) workflows in oncology. This application allows you to build rich patient contexts and test how AI agents interact with patients for symptom triage, wellness checks, and longitudinal care.

![Project Status](https://img.shields.io/badge/Status-Prototype-blue) ![Stack](https://img.shields.io/badge/Stack-FastAPI_React_LangGraph-green)

## 📊 Current Progress

As of the latest build, the **Developer Console** features a complete data management and visualization loop.

| Feature Area | Status | Description |
| :--- | :---: | :--- |
| **Patient Profile Builder** | ✅ Complete | Full CRUD form with default "John Doe" personas and live JSON context sync. |
| **AI Profile Generation** | ✅ Complete | LLM-powered patient profile generation from free-text descriptions with realistic event histories. |
| **Data Persistence** | ✅ Complete | JSON-based storage (`patient_data.json`) persists profiles and event history across restarts. |
| **Event Timeline** | ✅ Complete | Longitudinal view of Symptoms, Wellness, and Treatments with manual entry forms. |
| **Data Visualization** | ✅ Complete | Interactive Recharts graph plotting Symptom Severity trends overlaid with Treatment events and intervals. |
| **Agent Tools Layer** | ✅ Complete | 8 LLM-callable tool functions with Pydantic schemas for operational workflows. |
| **Voice Agents (Chat)** | ✅ Complete | "Chat Simulator" interface for testing Agent logic (Symptom Triage & Wellness flows). |
| **Voice Agents (Voice)** | ⚠️ Pending | WebRTC/LiveKit integration handles UI placeholders but not real audio streams yet. |
| **AI Logic** | 🚧 In Progress | `chat_orchestrator.py` implements mock conversation flows; ready for LLM integration. |


---

## 🧬 Data Models & Schema

The application uses strict Pydantic schemas (backend) and mapped TypeScript-like structures (frontend) to ensure clinical data integrity.

### 1. Patient Profile
A comprehensive snapshot of the patient's clinical state.
```json
{
  "id": "uuid",
  "cancer_type": "Lung Adenocarcinoma",
  "stage": "IIIB",
  "measurable_disease": { "is_measurable": true, "description": "RUL mass" },
  "current_treatment": { "is_active": true, "regimen": "Carboplatin + Pemetrexed" },
  "ecog_score": 1,
  "tumor_markers_found": ["CEA", "PD-L1"],
  "medical_records_text": "Free text notes..."
}
```

### 2. Timeline Events (Longitudinal Data)
The timeline supports polymorphic event types, all sharing a common `BaseEvent`.

#### Symptom Event
Captures patient-reported outcomes (PROs) with structured measurements.
```json
{
  "event_type": "symptom",
  "timestamp": "ISO-8601",
  "measurements": [
    {
      "name": "Headache",
      "severity": { "value": 7, "scale": "0_10" },
      "trend": "worsening",
      "rawAnswer": "It hurts behind my eyes"
    }
  ]
}
```

#### Wellness Event
Captures Quality of Life (QoL) metrics.
```json
{
  "event_type": "wellness",
  "mood": 4, // 1-5 Scale
  "anxiety": 2 // 0-10 Scale
}
```

#### Treatment Event
Captures major clinical interventions for visualization overlay. Supports both point-in-time treatments (single infusions) and treatment intervals (courses with start/end dates).
```json
{
  "event_type": "treatment",
  "name": "Chemotherapy Cycle 1",
  "timestamp": "ISO-8601",
  "description": "Carboplatin/Pemetrexed",
  "start_timestamp": "ISO-8601", // Optional: start of treatment interval
  "end_timestamp": "ISO-8601"    // Optional: end of treatment interval
}
```

#### Workflow Result Event
Auditable artifact from triage workflows. Records routing decisions, safety flags, and what triggered escalation.
```json
{
  "event_type": "workflow_result",
  "workflow_name": "symptom_triage",
  "route": "yellow", // green, yellow, red
  "patient_summary": "We've noted your symptoms...",
  "clinician_summary": "Headache worsening 3->7 over 48h...",
  "safety_flags": ["rapid_symptom_progression"],
  "escalation_trigger": "Severity increase >4 points in 48 hours",
  "triage_confidence": 0.85,
  "signals": [] // Derived signals for trend detection
}
```

---

## 🛠️ Agent Tools Layer

The agent tools module (`backend/agents/tools.py`) provides the interface between LLM agents and the application's domain layer. Each tool is designed with Pydantic schemas and detailed docstrings for LLM function-calling.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM Agent                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ function calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  tools.py (Agent Interface)                  │
│  get_patient_context, get_recent_events, log_triage_...    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  store.py (Domain Layer)                     │
│  PatientStore: profiles, events, followup_tasks             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  patient_data.json                           │
└─────────────────────────────────────────────────────────────┘
```

### Available Tools

| Tool | Purpose |
| :--- | :--- |
| `get_patient_context` | Fetch patient profile, current regimen, ECOG score, and concerns |
| `get_care_plan_protocols` | Get complaint-specific criteria (red flags, escalation thresholds) |
| `get_recent_events` | Query events within time window for trend detection |
| `log_symptom_event` | Log structured symptom data to patient timeline |
| `log_wellness_check` | Log wellness/mood check-in |
| `log_workflow_result` | Create auditable workflow artifact (route, triggers, summary) |
| `create_followup_task` | Generate follow-up task for clinician queue |
| `escalate_to_human` | Flag for immediate human review |


### Tool Schemas

#### Triage Routes
```python
class TriageRoute(str, Enum):
    GREEN = "green"   # Self-manageable, no action needed
    YELLOW = "yellow" # Needs clinician review within 24-48h
    RED = "red"       # Urgent escalation required
```

#### Follow-up Task
```python
class FollowupTask(BaseModel):
    id: str
    patient_id: str
    urgency: TaskUrgency  # routine, urgent, stat
    summary: str
    context: Optional[str]
    triggered_by: Optional[str]  # Event ID that triggered this
    created_at: str
    status: TaskStatus  # pending, in_progress, completed, cancelled
```

#### Triage Assessment (Workflow Result)
```python
class WorkflowResultEvent(BaseEvent):
    workflow_name: str
    route: TriageRoute
    patient_summary: str        # Brief summary for patient
    clinician_summary: str      # Detailed summary for clinician
    safety_flags: List[str]     # Red flags identified
    escalation_trigger: str     # What triggered escalation
    triage_confidence: float    # Model confidence (0-1)
```

### Usage Example

```python
from agents.tools import (
    get_patient_context,
    get_care_plan_protocols,
    get_recent_events,
    log_workflow_result,
    create_followup_task,
    WorkflowResultInput,
    FollowupTaskInput
)
from schemas import TriageRoute, TaskUrgency

# 1. Get context and protocols (Authority for thresholds)
ctx = get_patient_context("patient-123")
protocols = get_care_plan_protocols("patient-123", chief_complaint="Headache")
# e.g., protocols[0].escalation_criteria = {'red': 'severity >= 8', 'yellow': 'severity >= 4'}

# 2. Check recent history for trends
recent = get_recent_events("patient-123", window_hours=72)

# 3. Log workflow result (The auditable artifact)
result = log_workflow_result("patient-123", WorkflowResultInput(
    route=TriageRoute.YELLOW,
    patient_summary="We've noted your symptoms and will have a nurse review.",
    clinician_summary="Headache severity 7/10. Matched 'yellow' criteria (severity >= 4).",
    safety_flags=["rapid_symptom_progression"],
    escalation_trigger="Severity 7/10 matches 'yellow' threshold",
    confidence=0.95
))

# 4. Create follow-up task for operational output
task = create_followup_task("patient-123", FollowupTaskInput(
    urgency=TaskUrgency.URGENT,
    summary="Review headache progression",
    triggered_by=result.id
))
```


### Webhook Integration

All agent tools are available via a standardized webhook interface for integration with external LLM platforms or voice gateways.

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/agent/tools/definitions` | `GET` | Get JSON definitions of all available tools (for discovery) |
| `/agent/tools/execute` | `POST` | Execute a specific tool with JSON arguments |

#### External Access via ngrok
To use these webhooks with external platforms (like Retell, Vapi, or Bland AI), you must expose your local server to the internet. 

1. **Start ngrok:**
   ```bash
   ngrok http 8000
   ```
2. **Use the public URL:**
   Replace `http://localhost:8000` with your ngrok URL (e.g., `https://53d12bc4e951.ngrok-free.app`).

**Execution Request Example:**
```json
{
  "tool_name": "log_workflow_result",
  "arguments": {
    "patient_id": "default",
    "result": {
      "route": "yellow",
      "patient_summary": "We've noted your headache...",
      "clinician_summary": "Headache worsening...",
      "escalation_trigger": "Severity increase matches threshold"
    }
  }
}
```


---

## 🎯 Core Capabilities

### 1. Patient Profile Builder
- **Rich Mock Data**: Automatically generates realistic clinical personas (e.g., Randomized Cancer Type + appropriate Regimen).
- **AI Generation**: Generate complete patient profiles with realistic event histories from free-text descriptions using Anthropic Claude.
- **Live Sync**: Changes in the UI immediately update the backend `patient_data.json`.

### 2. Timeline & Visualization
- **Unified Timeline**: Merges Symptoms, Wellness, and Treatments into a single reverse-chronological stream.
- **Symptom Chart**: A multi-line chart using `Recharts` to plot severity trends over time.
- **Treatment Visualization**: 
  - **Point Treatments**: Renders as dots on the chart (single infusions)
  - **Treatment Intervals**: Renders as shaded bands (`ReferenceArea`) spanning start to end dates (treatment courses)
  - Visualizes correlation between treatments and symptom spikes

### 3. Multi-Agent Voice System
A suite of specialized AI agents designed for specific clinical workflows.

#### 🏥 Patient-Initiated Symptom Check-In
*Use Case: Patient calls to report a new problem.*
- **Process**: Transcribes speech -> LLM Extraction -> `SymptomEvent`.
- **Output**: Generates a Triage Analysis (Green/Yellow/Red).

#### 🩺 AI-Initiated Clinical Triage
*Use Case: Proactive outreach based on reported symptoms.*
- **Mode**: Interactive Chat Simulator.
- **Flow**: Safety Screen -> Chief Complaint -> Drill Down.

#### 🧘 Wellness & Goals Check-In
*Use Case: Longitudinal tracking of QoL.*
- **Mode**: Empathetic conversational AI.
- **Focus**: Mood, Anxiety, Goal Progress.

---

## 🏗️ Tech Stack

### Frontend
- **React + Vite**: Fast, modern UI development.
- **DaisyUI + Tailwind**: Medical-grade component library.
- **Recharts**: Complex data visualization for clinical trends.

### Backend
- **FastAPI**: REST API with Pydantic validation.
- **Agent Tools Layer**: `agents/tools.py` provides 8 LLM-callable functions with Pydantic I/O schemas.
- **Domain Layer**: `store.py` handles CRUD + persistence for profiles, events, and follow-up tasks.
- **Persistence**: JSON file-based storage (`patient_data.json`) with polymorphic event handling.
- **Anthropic Claude**: LLM-powered patient profile and event history generation.

### AI & Orchestration
- **LangGraph**: (Setup) For managing conversational state machines.
- **DSPy**: (Dependency Installed) For optimizing prompts and extraction logic.
- **Anthropic API**: Structured JSON output for patient profile generation.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Anthropic API key (for AI profile generation)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/benyadabest/voice_agents-healthcare.git
    cd voice_agents-healthcare
    ```

2.  **Set up Backend Environment:**
    ```bash
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install langgraph dspy-ai langfuse
    ```
    
    **Configure API Key:**
    Create a `.env` file in the `backend/` directory:
    ```bash
    # backend/.env
    ANTHROPIC_API_KEY=sk-ant-api03-...
    ```
    
    The `.env` file is automatically loaded by `python-dotenv`. Alternatively, you can export the environment variable:
    ```bash
    export ANTHROPIC_API_KEY=sk-ant-api03-...
    ```
    
    **Note:** The `.env` file should be added to `.gitignore` (never commit API keys).

3.  **Start the Backend:**
    ```bash
    uvicorn main:app --reload --port 8000
    ```

4.  **Start the Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

5.  **Access the Console:**
    Open `http://localhost:5173` in your browser.

## 🔧 API Endpoints

### Profile Management
- `GET /profile` - Get active patient profile
- `GET /profiles` - List all profiles
- `POST /profile` - Create or update profile
- `POST /profile/new` - Create new profile with random mock data
- `POST /profile/generate` - **Generate profile from free-text description** (requires `ANTHROPIC_API_KEY`)
- `POST /profile/switch/{profile_id}` - Switch active profile
- `DELETE /profile/{profile_id}` - Delete profile

### Timeline Events
- `GET /events/{patient_id}` - Get all events for a patient
- `POST /events` - Create new event (symptom/wellness/treatment)
- `DELETE /events/{event_id}` - Delete event

## 🤖 AI Profile Generation

The system uses **Anthropic Claude** with **structured JSON output** to generate realistic patient profiles and event histories.

### How It Works

1. **Structured Output**: The LLM is prompted to return valid JSON matching the exact Pydantic schema structure for `PatientProfile` and event types (`SymptomEvent`, `WellnessEvent`, `TreatmentEvent`).

2. **Validation**: All LLM output is validated against Pydantic models before being saved, ensuring data integrity.

3. **Realistic History**: The generator creates temporally consistent events:
   - Treatment courses with realistic intervals (2-3 week cycles)
   - Symptom events correlated with treatments (e.g., nausea after chemo)
   - Wellness check-ins distributed over time
   - Both point treatments (single infusions) and interval treatments (courses)

4. **Usage**: In the Profile Builder UI, check "Generate with AI" and provide a free-text description of the patient. The system generates:
   - Complete patient profile matching the description
   - 6 months (configurable) of realistic event history
   - All events properly typed and validated

### Example Prompt
```
"65-year-old female with Stage IIIB lung adenocarcinoma, currently on 
Carboplatin + Pemetrexed. Experiencing fatigue and occasional nausea. 
Former smoker, quit 5 years ago. Concerned about treatment side effects 
affecting daily activities."
```

The LLM generates a complete profile with appropriate demographics, cancer staging, treatment regimen, and a realistic timeline of symptoms, wellness check-ins, and treatment events.
