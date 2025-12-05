# Oncology Voice Agent & RPM Console

A developer-focused platform for prototyping and simulating voice-powered Remote Patient Monitoring (RPM) workflows in oncology. This application allows you to build rich patient contexts and test how AI agents interact with patients for symptom triage, wellness checks, and longitudinal care.

![Project Status](https://img.shields.io/badge/Status-Prototype-blue) ![Stack](https://img.shields.io/badge/Stack-FastAPI_React_LangGraph-green)

## 📊 Current Progress

As of the latest build, the foundational **Developer Console** is fully operational with simulated agent logic.

| Feature Area | Status | Description |
| :--- | :---: | :--- |
| **Patient Profile Builder** | ✅ Complete | Full CRUD form with default "John Doe" personas and live JSON context sync. |
| **Frontend Architecture** | ✅ Complete | React + Vite + DaisyUI setup with tabbed navigation and responsive layout. |
| **Backend API** | ✅ Complete | FastAPI endpoints for profile management and agent session handling. |
| **Agent: Patient-Initiated** | ⚠️ Simulated | Recording UI exists; currently returns mock JSON analysis (STT/LLM pending). |
| **Agent: AI-Initiated (Triage)** | ⚠️ Simulated | Functional Chat Simulator for testing logic; LiveKit voice integration pending. |
| **Agent: Wellness Check** | ⚠️ Simulated | Functional Chat Simulator for testing logic; LiveKit voice integration pending. |
| **AI Orchestration** | 🚧 In Progress | `chat_orchestrator.py` implements mock logic; LangGraph/DSPy integration is next. |

---

## 🎯 Core Capabilities

### 1. Patient Profile Builder
A comprehensive interface to create detailed, clinically relevant patient personas.
- **Demographics & Context**: Age, cancer type (e.g., Lung Adenocarcinoma), stage (e.g., IIIB), and social determinants.
- **Medical History**: Structured capture of prior therapies, current regimens (e.g., Carboplatin + Pemetrexed), and ECOG status.
- **Live JSON Sync**: Changes in the form are immediately reflected in a structured JSON object, serving as the "ground truth" context for all AI agents.

### 2. Multi-Agent Voice System
A suite of specialized AI agents designed for specific clinical workflows.

#### 🏥 Patient-Initiated Symptom Check-In
*Use Case: Patient calls to report a new problem.*
- **Input**: Audio recording (simulated via web microphone).
- **Process**: Transcribes speech and extracts structured clinical data.
- **Output**:
    - **Chief Complaint**: "Worsening headaches"
    - **Symptom Observations**: Severity (8/10), Location (Right Frontal), Impact (Cannot work).
    - **Triage Analysis**: Automated safety screening and recommendation (Green/Yellow/Red).

#### 🩺 AI-Initiated Clinical Triage
*Use Case: Proactive outreach based on reported symptoms or missed check-ins.*
- **Mode**: Interactive Chat Simulator (Voice/LiveKit ready).
- **Workflow**:
    1.  **Safety Screen**: Rule-out emergencies (chest pain, breathlessness).
    2.  **Assessment**: Drill down into specific symptoms (severity, onset, duration).
    3.  **Documentation**: Logs the interaction for clinical review.

#### 🧘 Wellness & Goals Check-In
*Use Case: Longitudinal tracking of Quality of Life (QoL).*
- **Mode**: Empathetic, conversational AI.
- **Focus**: Extracts functional status (ECOG changes), emotional well-being (anxiety/mood), and progress towards personal goals (e.g., "Walking the dog").

## 🏗️ Tech Stack

### Frontend
- **React + Vite**: Fast, modern UI development.
- **DaisyUI + Tailwind**: Clean, accessible, and responsive medical-grade components.
- **Audio**: Web Audio API for browser-based recording.

### Backend
- **FastAPI**: High-performance Python API for handling agent logic and data persistence.
- **Pydantic**: Strict data validation for clinical schemas.
- **In-Memory Store**: Lightweight state management for rapid prototyping (resets on restart).

### AI & Orchestration (In Progress)
- **LangGraph**: For managing conversational state machines (e.g., enforcing safety checks before clinical questions).
- **DSPy**: For optimizing prompts and extraction logic.
- **LiveKit**: (Planned) For real-time, low-latency voice streaming.

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

## 🔮 Future Roadmap
- [ ] **Real Voice Integration**: Connect backend to LiveKit/Deepgram for real-time speech-to-speech.
- [ ] **LLM Integration**: Connect mock endpoints to OpenAI/Anthropic via LangGraph.
- [ ] **Persistence**: Switch from in-memory storage to a vector database (Postgres/pgvector) for long-term memory.
- [ ] **Timeline Visualization**: A graphical view of symptom trends over time.
