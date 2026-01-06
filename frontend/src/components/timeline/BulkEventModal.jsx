import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBulkEvents } from '../../api';

const BulkEventModal = ({ isOpen, onClose, patientId }) => {
    const queryClient = useQueryClient();
    
    const [prompt, setPrompt] = useState('');
    const [previewEvents, setPreviewEvents] = useState(null);
    const [error, setError] = useState(null);

    const generateMutation = useMutation({
        mutationFn: ({ patientId, prompt }) => createBulkEvents(patientId, prompt),
        onSuccess: (data) => {
            setPreviewEvents(data.events);
            setError(null);
        },
        onError: (error) => {
            console.error('Failed to generate events', error);
            setError(error.response?.data?.detail || 'Failed to generate events. Please try again.');
            setPreviewEvents(null);
        }
    });

    const handleGenerate = () => {
        if (!prompt.trim()) {
            setError('Please describe the events you want to add');
            return;
        }
        setError(null);
        generateMutation.mutate({ patientId, prompt });
    };

    const handleConfirm = () => {
        // Events are already saved by the backend, just close and refresh
        queryClient.invalidateQueries({ queryKey: ['events', patientId] });
        handleClose();
    };

    const handleClose = () => {
        setPrompt('');
        setPreviewEvents(null);
        setError(null);
        onClose();
    };

    const formatEventForPreview = (event) => {
        const date = new Date(event.timestamp).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        
        let details = '';
        
        if (event.event_type === 'symptom') {
            const symptoms = event.measurements?.map(m => 
                `${m.name} (${m.severity?.value}/10)`
            ).join(', ') || 'Symptom';
            details = symptoms;
        } else if (event.event_type === 'wellness') {
            const parts = [];
            if (event.mood) parts.push(`Mood: ${event.mood}/5`);
            if (event.anxiety) parts.push(`Anxiety: ${event.anxiety}/10`);
            details = parts.join(', ') || 'Wellness check';
        } else if (event.event_type === 'treatment') {
            details = event.name || 'Treatment';
        } else if (event.event_type === 'lifestyle') {
            details = `${event.name} (${event.category})`;
        }
        
        return { date, type: event.event_type, details };
    };

    const getEventTypeColor = (type) => {
        switch (type) {
            case 'symptom': return 'badge-primary';
            case 'wellness': return 'badge-secondary';
            case 'treatment': return 'badge-accent';
            case 'lifestyle': return 'badge-info';
            default: return 'badge-ghost';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-2">Add Events with AI</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Describe your health events in natural language and we'll create structured entries for you.
                </p>

                {!previewEvents ? (
                    <>
                        {/* Prompt Input */}
                        <div className="form-control mb-4">
                            <textarea 
                                className="textarea textarea-bordered h-32 text-base"
                                placeholder="Describe what happened... For example:

• Last week I had headaches on Monday and Wednesday, both were pretty severe
• Started a new exercise routine on Tuesday - went for a 30 minute walk
• Felt anxious on Thursday after my doctor's appointment
• Had nausea yesterday after dinner, mild severity"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Example Prompts */}
                        <div className="mb-4">
                            <p className="text-xs text-gray-400 mb-2">Try these examples:</p>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    "Had a headache yesterday, severity 6",
                                    "Started intermittent fasting on Monday",
                                    "Slept poorly last 3 nights",
                                    "Took my medication this morning"
                                ].map((example, idx) => (
                                    <button
                                        key={idx}
                                        className="btn btn-xs btn-ghost text-xs"
                                        onClick={() => setPrompt(example)}
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="alert alert-error mb-4">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={handleClose}>
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary gap-2"
                                onClick={handleGenerate}
                                disabled={generateMutation.isPending || !prompt.trim()}
                            >
                                {generateMutation.isPending ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Generate Events
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Preview Events */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-sm">
                                    Generated {previewEvents.length} event{previewEvents.length !== 1 ? 's' : ''}
                                </h4>
                                <span className="badge badge-success badge-sm">Saved</span>
                            </div>
                            
                            <div className="bg-base-200 rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                                {previewEvents.map((event, idx) => {
                                    const { date, type, details } = formatEventForPreview(event);
                                    return (
                                        <div key={idx} className="bg-white rounded p-2 flex items-center gap-3">
                                            <span className={`badge ${getEventTypeColor(type)} badge-sm capitalize`}>
                                                {type}
                                            </span>
                                            <span className="text-xs text-gray-500">{date}</span>
                                            <span className="text-sm flex-1">{details}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Success Message */}
                        <div className="alert alert-success mb-4">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm">Events have been added to your timeline!</span>
                        </div>

                        {/* Actions */}
                        <div className="modal-action">
                            <button 
                                className="btn btn-ghost"
                                onClick={() => {
                                    setPreviewEvents(null);
                                    setPrompt('');
                                }}
                            >
                                Add More
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={handleConfirm}
                            >
                                Done
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BulkEventModal;

