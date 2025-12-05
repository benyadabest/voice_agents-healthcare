import React, { useState, useRef } from 'react';
import { simulateAgentAnalysis } from '../../api';
import ThreeViewOutput from './ThreeViewOutput';

const AgentRecorder = ({ agentType, title, promptText, defaultTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Simulating recording for now since we don't have a real STT backend connected yet
  // In a real app, we would use the MediaRecorder API here
  
  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTranscript("");
      setAnalysis(null);
    } else {
      setIsRecording(false);
      handleProcessRecording();
    }
  };

  const handleProcessRecording = async () => {
    setIsProcessing(true);
    // Simulate "Processing" time
    setTimeout(async () => {
        // Use the passed default transcript if the user didn't speak (mocking STT)
        // In real app, this comes from the audio blob sent to STT service
        const finalTranscript = defaultTranscript || "I've been having these headaches that are getting worse, about an 8 out of 10. It's mostly on the right side. I also feel nauseous, maybe from the chemo two days ago. I can't even go to work.";
        setTranscript(finalTranscript);
        
        try {
            const result = await simulateAgentAnalysis(agentType, finalTranscript);
            setAnalysis(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Control Bar */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-500 mb-6">{promptText}</p>
        
        <button 
            className={`btn btn-circle btn-lg ${isRecording ? 'btn-error animate-pulse' : 'btn-primary'} shadow-xl border-4 border-base-100`}
            onClick={toggleRecording}
        >
            {isRecording ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
        </button>
        <p className="mt-4 text-sm font-semibold">
            {isRecording ? "Listening... (Click to Stop)" : isProcessing ? "Processing..." : "Click Mic to Start Check-In"}
        </p>
      </div>

      {/* Results View */}
      <div className="flex-1 min-h-0">
         {isProcessing ? (
             <div className="flex items-center justify-center h-full">
                 <span className="loading loading-bars loading-lg text-primary"></span>
             </div>
         ) : (
             <ThreeViewOutput transcript={transcript} analysis={analysis} />
         )}
      </div>
    </div>
  );
};

export default AgentRecorder;

