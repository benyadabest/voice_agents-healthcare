# Oncology Voice Agent & RPM Console

A developer-focused platform for prototyping and simulating voice-powered Remote Patient Monitoring (RPM) workflows in oncology. This application allows you to build rich patient contexts and test how AI agents interact with patients for symptom triage, wellness checks, and longitudinal care.

![Project Status](https://img.shields.io/badge/Status-Prototype-blue) ![Stack](https://img.shields.io/badge/Stack-FastAPI_React_LangGraph-green)

## 📊 Current Progress

As of the latest build, the **Developer Console** features a complete data management and visualization loop.

| Feature Area | Status | Description |
| :--- | :---: | :--- |
| **Patient Profile Builder** | ✅ Complete | Full CRUD form with default "John Doe" personas and live JSON context sync. |
| **Data Persistence** | ✅ Complete | JSON-based storage (`patient_data.json`) persists profiles and event history across restarts. |
| **Event Timeline** | ✅ Complete | Longitudinal view of Symptoms, Wellness, and Treatments with manual entry forms. |
| **Data Visualization** | ✅ Complete | Interactive Recharts graph plotting Symptom Severity trends overlaid with Treatment events. |
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
Captures major clinical interventions for visualization overlay.
```json
{
  "event_type": "treatment",
  "name": "Chemotherapy Cycle 1",
  "date": "YYYY-MM-DD",
  "description": "Carboplatin/Pemetrexed"
}
```

---

## 🎯 Core Capabilities

### 1. Patient Profile Builder
- **Rich Mock Data**: Automatically generates realistic clinical personas (e.g., Randomized Cancer Type + appropriate Regimen).
- **Live Sync**: Changes in the UI immediately update the backend `patient_data.json`.

### 2. Timeline & Visualization
- **Unified Timeline**: Merges Symptoms, Wellness, and Treatments into a single reverse-chronological stream.
- **Symptom Chart**: A multi-line chart using `Recharts` to plot severity trends over time.
- **Treatment Overlays**: Renders vertical **Reference Lines** and **Icons** on the chart to visualize correlation between treatments (e.g., Chemo) and symptom spikes.

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
- **Persistence**: JSON file-based storage (`store.py`) handling multiple profiles.
- **Polymorphism**: API endpoints handle `Union[SymptomEvent, WellnessEvent...]` automatically.

### AI & Orchestration
- **LangGraph**: (Setup) For managing conversational state machines.
- **DSPy**: (Dependency Installed) For optimizing prompts and extraction logic.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/benyadabest/voice_agents-healthcare.git
    cd voice_agents-healthcare
    ```

2.  **Start the Backend:**
    ```bash
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install langgraph dspy-ai langfuse
    uvicorn main:app --reload --port 8000
    ```

3.  **Start the Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  **Access the Console:**
    Open `http://localhost:5173` in your browser.
