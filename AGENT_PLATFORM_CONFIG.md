# Agent Platform Configuration (Retell / Vapi)

This document provides the exact configuration required to hook up the agent tools to an external voice platform via the ngrok webhook.

**Global Webhook URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
**Method:** `POST`
**Headers:** `{"Content-Type": "application/json"}`

---

## 1. get_patient_context

**Description:** Retrieve the full patient context including profile, treatment info, and concerns. Use this at the start of a conversation to understand the patient's background and clinical state.

- **Name:** `get_patient_context`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** No
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `get_patient_context` (Fixed)
  - `arguments`:
    - `patient_id`: (Required) The unique identifier for the patient.

---

## 2. get_care_plan_protocols

**Description:** Get relevant clinical protocols for a patient based on their regimen and chief complaint. This tool is the **authority for escalation thresholds**. The agent must fetch this to know what constitutes a RED or YELLOW flag for the current symptom.

- **Name:** `get_care_plan_protocols`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** No
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `get_care_plan_protocols` (Fixed)
  - `arguments`:
    - `patient_id`: (Required) The unique identifier for the patient.
    - `chief_complaint`: (Optional) The name of the symptom (e.g., "Headache") to get specific criteria for.

---

## 3. get_recent_events

**Description:** Query historical events within a time window for trend detection. Use this to compare current symptoms to last week (e.g., "Is your nausea worse than it was 3 days ago?").

- **Name:** `get_recent_events`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** No
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `get_recent_events` (Fixed)
  - `arguments`:
    - `patient_id`: (Required) The unique identifier for the patient.
    - `window_hours`: (Optional, default 168) How many hours back to look.
    - `event_types`: (Optional) Array of types to filter (e.g., `["symptom"]`).

---

## 4. log_symptom_event

**Description:** Log a structured symptom report to the patient's timeline. Use this after gathering severity and trend info for a specific symptom.

- **Name:** `log_symptom_event`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** Yes
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `log_symptom_event` (Fixed)
  - `arguments`:
    - `patient_id`: (Required)
    - `symptom`:
      - `name`: (Required) e.g., "Nausea"
      - `severity`: (Required) 0-10 integer
      - `trend`: (Optional) "worsening", "stable", or "improving"
      - `notes`: (Optional) Context from patient

---

## 5. log_wellness_check

**Description:** Log mood and anxiety scores during a wellness check-in. Use this to track longitudinal Quality of Life (QoL).

- **Name:** `log_wellness_check`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** Yes
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `log_wellness_check` (Fixed)
  - `arguments`:
    - `patient_id`: (Required)
    - `wellness`:
      - `mood`: (Required) 1-5 integer
      - `anxiety`: (Required) 0-10 integer
      - `notes`: (Optional)

---

## 6. log_workflow_result

**Description:** Create the auditable artifact for the triage encounter. Call this at the end of every workflow to record the final routing decision (green/yellow/red) and the criteria that triggered it.

- **Name:** `log_workflow_result`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** Yes
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `log_workflow_result` (Fixed)
  - `arguments`:
    - `patient_id`: (Required)
    - `result`:
      - `route`: (Required) "green", "yellow", or "red"
      - `patient_summary`: (Required) Brief explanation for patient
      - `clinician_summary`: (Optional) Detailed summary for care team
      - `escalation_trigger`: (Optional) The specific threshold or flag triggered
      - `confidence`: (Optional) 0-1 score

---

## 7. create_followup_task

**Description:** Generate a follow-up item for the clinician's queue. Use this when the route is 'yellow' (requires review within 24-48h).

- **Name:** `create_followup_task`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** Yes
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `create_followup_task` (Fixed)
  - `arguments`:
    - `patient_id`: (Required)
    - `task`:
      - `urgency`: (Required) "routine", "urgent", or "stat"
      - `summary`: (Required) e.g., "New onset nausea - severity 6"
      - `triggered_by`: (Optional) The ID of the workflow result

---

## 8. escalate_to_human

**Description:** Trigger an immediate escalation to a live human clinician. Use this for 'red' routes or when urgent safety concerns arise (e.g., chest pain).

- **Name:** `escalate_to_human`
- **Method:** `POST`
- **URL:** `https://53d12bc4e951.ngrok-free.app/agent/tools/execute`
- **Response timeout:** 20 seconds
- **Disable interruptions:** Yes
- **Pre-tool speech:** Auto
- **Execution mode:** Immediate
- **Tool call sound:** None
- **Body parameters:**
  - `tool_name`: `escalate_to_human` (Fixed)
  - `arguments`:
    - `patient_id`: (Required)
    - `escalation`:
      - `reason`: (Required) Why escalation is needed
      - `severity`: (Optional) "medium", "high", or "critical"
      - `contact_preference`: (Optional) "call", "message", or "both"

