import React, { useState } from 'react';
import AgentRecorder from './AgentRecorder';
import ChatWindow from './ChatWindow';

const VoiceAgents = () => {
  const [activeTab, setActiveTab] = useState('patient_symptom');

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Tabs */}
      <div className="flex justify-between items-center mb-4 bg-base-200 p-1 rounded-lg">
          <div className="tabs tabs-boxed bg-transparent">
            <a 
                className={`tab ${activeTab === 'patient_symptom' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('patient_symptom')}
            >
                Patient-Initiated
            </a>
            <a 
                className={`tab ${activeTab === 'ai_symptom' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('ai_symptom')}
            >
                AI (Symptom)
            </a>
            <a 
                className={`tab ${activeTab === 'ai_wellness' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('ai_wellness')}
            >
                AI (Wellness)
            </a>
          </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'patient_symptom' && (
            <AgentRecorder 
                agentType="patient_initiated_checkin"
                title="Patient-Initiated Symptom Check-In"
                promptText="Simulate a patient calling to report a new or worsening symptom."
                defaultTranscript="I've been having these headaches that are getting worse, about an 8 out of 10. It's mostly on the right side. I also feel nauseous, maybe from the chemo two days ago. I can't even go to work."
            />
        )}
        
        {activeTab === 'ai_symptom' && (
            <ChatWindow 
                agentType="ai_symptom"
                title="AI-Initiated Symptom Check-In"
                initialMessage="Hi John, I noticed you reported a headache yesterday. How are you feeling right now?"
            />
        )}

        {activeTab === 'ai_wellness' && (
            <ChatWindow 
                agentType="ai_wellness"
                title="AI-Initiated Wellness Check-In"
                initialMessage="Good morning John. Just checking in on your goal to walk the dog this week. How is that going?"
            />
        )}
      </div>
    </div>
  );
};

export default VoiceAgents;
