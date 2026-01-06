"""
Example Usage of Agent Tools
----------------------------
This file demonstrates how to call the agent tools directly in Python.
For LLM function calling integration, see the TOOL_REGISTRY in tools.py.
"""

from agents.tools import (
    get_patient_context,
    get_care_plan_protocols,
    get_recent_events,
    log_symptom_event,
    log_wellness_check,
    log_workflow_result,
    create_followup_task,
    escalate_to_human,
    SymptomInput,
    WellnessInput,
    WorkflowResultInput,
    FollowupTaskInput,
    EscalationInput
)
from schemas import TriageRoute, TaskUrgency
from store import store

# ============================================================================
# Getting Patient ID
# ============================================================================

# Use a known patient ID or active one
active_profile = store.get_active_profile()
patient_id = active_profile.id if active_profile else "default"

# ============================================================================
# Example 1: Get Patient Context (Start Here)
# ============================================================================

print("\n=== Example 1: Get Patient Context ===")
context = get_patient_context(patient_id)
print(f"Patient: {context.profile.name}")
print(f"Current Regimen: {context.current_regimen}")

# ============================================================================
# Example 2: Get Care Plan Protocols (Source of Truth for Thresholds)
# ============================================================================

print("\n=== Example 2: Get Care Plan Protocols ===")
# Agent should provide the chief complaint to get specific guidance
protocols = get_care_plan_protocols(patient_id, chief_complaint="Headache")
for protocol in protocols:
    print(f"\nProtocol: {protocol.name}")
    print(f"Complaint: {protocol.complaint}")
    print(f"Escalation Criteria: {protocol.escalation_criteria}")
    print(f"Red Flags: {protocol.red_flags[:3]}...")

# ============================================================================
# Example 3: Check Recent Events for Trends
# ============================================================================

print("\n=== Example 3: Get Recent Events (Last 72 Hours) ===")
recent_events = get_recent_events(patient_id, window_hours=72, event_types=["symptom"])
print(f"Found {len(recent_events)} recent symptom events")

# ============================================================================
# Example 4: Log a Symptom Event
# ============================================================================

print("\n=== Example 4: Log Symptom Event ===")
symptom = SymptomInput(
    name="Headache",
    severity=7,
    trend="worsening",
    notes="Persistent throbbing"
)
symptom_event = log_symptom_event(patient_id, symptom)
print(f"Created symptom event: {symptom_event.id}")

# ============================================================================
# Example 5: Log a Workflow Result (Auditable Artifact)
# ============================================================================

print("\n=== Example 5: Log Workflow Result ===")

# THE AGENT DETERMINES THE ROUTE BY MATCHING OBSERVATIONS AGAINST PROTOCOLS
# (In this example, severity 7 matches the 'yellow' criteria in the protocol)
result = log_workflow_result(
    patient_id,
    WorkflowResultInput(
        route=TriageRoute.YELLOW,
        patient_summary="We've noted your headache. A nurse will review this shortly.",
        clinician_summary="Headache severity 7/10. Matches 'yellow' threshold (severity >= 4).",
        safety_flags=["worsening_trend"],
        escalation_trigger="Severity 7/10 and worsening trend",
        confidence=0.95
    )
)
print(f"Created workflow result: {result.id}, Route: {result.route}")

# ============================================================================
# Example 6: Full Triage Flow (As an Agent Would Orchestrate It)
# ============================================================================

def run_triage_workflow(patient_id: str, symptom_name: str, severity: int):
    """
    Example of how an LLM agent orchestrates the triage workflow.
    NO HARDCODED THRESHOLDS - THE AGENT USES THE PROTOCOLS.
    """
    print(f"\n--- Running Triage Workflow for {symptom_name} ({severity}/10) ---")

    # 1. Get context and protocols for the specific complaint
    protocols = get_care_plan_protocols(patient_id, chief_complaint=symptom_name)
    protocol = protocols[0] if protocols else None
    
    if not protocol:
        print("No specific protocol found.")
        return None

    # 2. Determine route based on protocol's escalation_criteria
    # NOTE: The agent parses the protocol's strings or instructions. 
    # For this Python example, we'll simulate the agent matching the criteria.
    route = TriageRoute.GREEN
    escalation_trigger = None
    
    # Simulate Agent matching severity against protocol criteria
    # e.g. protocol.escalation_criteria = {'red': 'severity >= 8', 'yellow': 'severity >= 4'}
    if severity >= 8: # Matches 'red' criteria from protocol
        route = TriageRoute.RED
        escalation_trigger = protocol.escalation_criteria.get('red')
    elif severity >= 4: # Matches 'yellow' criteria from protocol
        route = TriageRoute.YELLOW
        escalation_trigger = protocol.escalation_criteria.get('yellow')

    # 3. Log the symptom event
    log_symptom_event(patient_id, SymptomInput(name=symptom_name, severity=severity))

    # 4. Log the workflow result
    workflow_result = log_workflow_result(
        patient_id,
        WorkflowResultInput(
            route=route,
            patient_summary=f"Logged your {symptom_name}. A nurse will review." if route != TriageRoute.GREEN else "Keep monitoring.",
            clinician_summary=f"Matched protocol: {protocol.name}. Rule triggered: {escalation_trigger}",
            escalation_trigger=escalation_trigger if route != TriageRoute.GREEN else None,
            confidence=1.0
        )
    )
    print(f"Workflow Complete. Route: {route}")

    # 5. Handle operational side-effects
    if route == TriageRoute.YELLOW:
        create_followup_task(
            patient_id,
            FollowupTaskInput(
                urgency=TaskUrgency.URGENT,
                summary=f"Review {symptom_name} - {escalation_trigger}",
                triggered_by=workflow_result.id
            )
        )
    elif route == TriageRoute.RED:
        escalate_to_human(
            patient_id,
            EscalationInput(reason=f"RED FLAG: {symptom_name} - {escalation_trigger}")
        )
    
    return workflow_result

if __name__ == "__main__":
    run_triage_workflow(patient_id, "Headache", 7)


