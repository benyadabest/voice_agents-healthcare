"""
Chat Orchestrator
-----------------
Manages the conversational state using LangGraph (skeleton).

This is where we will eventually plug in:
1. dspy for prompt optimization
2. LangFuse for tracing/observability
3. LangGraph for state management (Safety Check -> Chief Complaint -> Drill Down)

For now, it implements a simple mock turn-based logic.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel

class ChatState(BaseModel):
    messages: List[Dict[str, str]] = []
    context: Dict = {}
    current_step: str = "greeting" 
    # Steps: greeting -> safety_screen -> chief_complaint -> drill_down -> closing

def process_chat_message(message: str, state: ChatState, agent_type: str):
    """
    Mock Logic Engine to simulate the agent flow.
    """
    response = ""
    next_step = state.current_step
    
    if agent_type == "ai_symptom":
        if state.current_step == "greeting":
            response = "I noticed you reported a headache yesterday. Before we continue, are you experiencing any chest pain or shortness of breath right now?"
            next_step = "safety_screen"
        
        elif state.current_step == "safety_screen":
            if "yes" in message.lower():
                response = "Please hang up and call 911 immediately. This requires urgent attention."
                next_step = "terminated"
            else:
                response = "Glad to hear that. Tell me more about your headache. On a scale of 0-10, how severe is it currently?"
                next_step = "severity_check"
        
        elif state.current_step == "severity_check":
            response = "Understood. Has this stopped you from doing your normal daily activities?"
            next_step = "impact_check"
            
        elif state.current_step == "impact_check":
            response = "Thank you for sharing. I've logged these details. A nurse will review this shortly. Is there anything else?"
            next_step = "closing"
            
        else:
            response = "Take care."

    elif agent_type == "ai_wellness":
        if state.current_step == "greeting":
            response = "Good morning. Just checking in on your goal to walk the dog. Did you manage to get out this week?"
            next_step = "goal_check"
        elif state.current_step == "goal_check":
            response = "That's great context. How have you been feeling emotionally? Any anxiety about your upcoming scan?"
            next_step = "mood_check"
        else:
            response = "Thanks for chatting. I'll update your wellness profile."
            next_step = "closing"
            
    # Update State
    state.messages.append({"role": "user", "content": message})
    state.messages.append({"role": "assistant", "content": response})
    state.current_step = next_step
    
    return {
        "response": response,
        "updated_state": state.dict()
    }

