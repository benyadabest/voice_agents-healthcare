import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPatientEvents, createEvent, getProfile, deleteEvent } from '../../api';
import SymptomChart from './SymptomChart';

const Timeline = ({ patientId }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('symptom'); // symptom, wellness, or treatment

  // Form State
  const [symptomName, setSymptomName] = useState("");
  const [severity, setSeverity] = useState("");
  const [trend, setTrend] = useState("stable");
  const [mood, setMood] = useState("3");
  const [anxiety, setAnxiety] = useState("0");
  const [notes, setNotes] = useState("");
  
  // Treatment Fields
  const [treatmentName, setTreatmentName] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().split('T')[0]);

  // Use React Query for events
  // Fallback: If no patientId prop, we rely on the one fetched via profile? 
  // Ideally, the parent App.jsx passes it.
  
  // Fetch active profile ID if not provided (fallback)
  const { data: activeProfile } = useQuery({
      queryKey: ['activeProfile'],
      queryFn: getProfile,
      enabled: !patientId, // Only run if prop is missing
  });

  const targetId = patientId || activeProfile?.id;

  const { data: events = [], isLoading: loading } = useQuery({
      queryKey: ['events', targetId],
      queryFn: () => getPatientEvents(targetId),
      enabled: !!targetId,
  });

  const createMutation = useMutation({
      mutationFn: createEvent,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['events', targetId] });
          setShowModal(false);
          resetForm();
      },
      onError: (error) => {
          console.error("Failed to create event", error);
          alert(`Failed to save event: ${error.message || "Unknown error"}`);
      }
  });

  const deleteMutation = useMutation({
      mutationFn: deleteEvent,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['events', targetId] });
      },
      onError: (error) => {
          console.error("Failed to delete event", error);
          alert("Failed to delete event.");
      }
  });

  const handleDeleteEvent = (eventId) => {
      if (!window.confirm("Are you sure you want to delete this event?")) return;
      deleteMutation.mutate(eventId);
  };

  const handleCreateEvent = () => {
    if (!targetId) {
        alert("No active patient selected. Please go to the Patient Profile tab and ensure a profile is loaded.");
        return;
    }

    const baseEvent = {
        id: crypto.randomUUID(),
        patient_id: targetId,
        timestamp: new Date().toISOString(),
        notes: notes
    };

    let payload = {};

    if (modalType === 'symptom') {
        if (!symptomName) {
            alert("Please enter a symptom name.");
            return;
        }
        payload = {
            ...baseEvent,
            event_type: "symptom",
            // Legacy/Display fields (optional but good for compatibility)
            symptom_name: symptomName,
            severity: severity ? parseInt(severity) : null,
            trend: trend,
            // New Structured Measurements
            measurements: [
                {
                    name: symptomName,
                    severity: {
                        value: severity ? parseInt(severity) : null,
                        scale: "0_10",
                        label: "user_reported"
                    },
                    trend: trend,
                    rawAnswer: notes
                }
            ]
        };
    } else if (modalType === 'wellness') {
        payload = {
            ...baseEvent,
            event_type: "wellness",
            mood: mood ? parseInt(mood) : null,
            anxiety: anxiety ? parseInt(anxiety) : null
        };
    } else     if (modalType === 'treatment') {
        if (!treatmentName) {
            alert("Please enter a treatment name.");
            return;
        }
        // Normalize date to ISO timestamp
        const timestamp = new Date(treatmentDate).toISOString();
        
        payload = {
            ...baseEvent,
            timestamp: timestamp, // Explicitly set timestamp from picker
            event_type: "treatment",
            name: treatmentName,
            description: notes // mapping notes to description for now
        };
    }

    createMutation.mutate(payload);
  };

  const resetForm = () => {
      setSymptomName("");
      setSeverity("");
      setTrend("stable");
      setMood("3");
      setAnxiety("0");
      setNotes("");
      setTreatmentName("");
      setTreatmentDate(new Date().toISOString().split('T')[0]);
  };

  const openModal = (type) => {
      setModalType(type);
      resetForm();
      setShowModal(true);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header / Actions */}
      <div className="flex justify-between items-center mb-4 bg-base-200 p-2 rounded-lg">
          <h2 className="text-lg font-bold px-2">Patient Timeline</h2>
          <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => openModal('symptom')}>+ Symptom</button>
              <button className="btn btn-sm btn-secondary" onClick={() => openModal('wellness')}>+ Wellness</button>
              <button className="btn btn-sm btn-accent" onClick={() => openModal('treatment')}>+ Treatment</button>
          </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* Chart Section */}
          <SymptomChart events={events} />

          {loading ? (
              <div className="flex justify-center p-4"><span className="loading loading-spinner"></span></div>
          ) : events.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">No events recorded yet.</div>
          ) : (
              <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
                  {events.map((evt, idx) => (
                      <li key={evt.id || idx}>
                          <div className="timeline-middle">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${evt.event_type === 'symptom' ? 'text-primary' : evt.event_type === 'treatment' ? 'text-accent' : evt.event_type === 'workflow_result' ? 'text-info' : 'text-secondary'}`}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                          </div>
                          <div className="timeline-end mb-10 md:text-start w-full group">
                              <time className="font-mono italic text-xs opacity-50 flex items-center gap-1">
                                  {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "Unknown Date"}
                                  {/* Source Badge */}
                                  {evt.source === 'voice' && <span className="badge badge-xs badge-ghost" title="Voice-derived">🎙️</span>}
                                  {evt.source === 'manual' && <span className="badge badge-xs badge-ghost" title="Manual Entry">⌨️</span>}
                              </time>
                              <div className="text-sm font-black uppercase tracking-wider mt-1 flex justify-between">
                                  <span>{evt.event_type.replace('_', ' ')}</span>
                                  {/* Confidence Indicator if < 1.0 */}
                                  {evt.confidence !== undefined && evt.confidence < 1.0 && (
                                      <span className="text-xs text-warning" title={`Confidence: ${Math.round(evt.confidence * 100)}%`}>
                                          ⚠️ {(evt.confidence * 100).toFixed(0)}%
                                      </span>
                                  )}
                              </div>
                              <div className={`card bg-base-100 shadow-sm border p-3 mt-2 min-w-[300px] relative ${evt.event_type === 'treatment' ? 'border-accent' : evt.event_type === 'workflow_result' ? (evt.route === 'red' ? 'border-error' : evt.route === 'yellow' ? 'border-warning' : 'border-success') : 'border-base-200'}`}>
                                  {/* Delete Button (Hidden until hover) */}
                                  <button 
                                    className="btn btn-xs btn-circle btn-ghost absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-error"
                                    onClick={() => handleDeleteEvent(evt.id)}
                                    title="Delete Event"
                                    disabled={deleteMutation.isPending}
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>

                                  {evt.event_type === 'symptom' && (
                                      <div>
                                          {/* Header based on first measurement or fallback */}
                                          <div className="flex justify-between items-center pr-6 mb-2">
                                              <span className="font-bold text-lg">
                                                  {evt.symptom_name || (evt.measurements?.[0]?.name) || "Unspecified Symptom"}
                                              </span>
                                              {(evt.severity !== null || evt.measurements?.[0]?.severity?.value !== undefined) && (
                                                  <div className="badge badge-outline">
                                                      Severity: {evt.severity ?? evt.measurements?.[0]?.severity?.value}/10
                                                  </div>
                                              )}
                                          </div>
                                          
                                          {/* Measurement List */}
                                          {evt.measurements && evt.measurements.length > 0 && (
                                              <div className="space-y-1">
                                                  {evt.measurements.map((m, i) => (
                                                      <div key={i} className="text-xs text-gray-500 bg-base-200 p-1 rounded px-2 flex justify-between">
                                                          <span>{m.name}</span>
                                                          <span>
                                                              {m.severity?.value}/10
                                                              {m.trend && <span className="ml-1 italic">({m.trend})</span>}
                                                          </span>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                          
                                          {/* Legacy Trend Fallback */}
                                          {!evt.measurements && evt.trend && <div className="text-xs text-gray-500 mt-1">Trend: {evt.trend}</div>}
                                      </div>
                                  )}
                                  {evt.event_type === 'wellness' && (
                                      <div className="grid grid-cols-2 gap-2">
                                          {evt.mood !== null && (
                                              <div className="flex flex-col">
                                                  <span className="text-xs uppercase opacity-70">Mood</span>
                                                  <span className="font-bold">{evt.mood}/5</span>
                                              </div>
                                          )}
                                          {evt.anxiety !== null && (
                                              <div className="flex flex-col">
                                                  <span className="text-xs uppercase opacity-70">Anxiety</span>
                                                  <span className="font-bold">{evt.anxiety}/10</span>
                                              </div>
                                          )}
                                      </div>
                                  )}
                                  {evt.event_type === 'treatment' && (
                                      <div>
                                          <div className="flex justify-between items-center pr-6">
                                              <span className="font-bold text-lg text-accent">{evt.name}</span>
                                              {/* Display date part of timestamp for readability */}
                                              <span className="badge badge-accent badge-outline">
                                                  {new Date(evt.timestamp).toLocaleDateString()}
                                              </span>
                                          </div>
                                      </div>
                                  )}
                                  {evt.event_type === 'workflow_result' && (
                                      <div>
                                          <div className="flex justify-between items-center pr-6 mb-2">
                                              <span className="font-bold text-lg">{evt.workflow_name}</span>
                                              {evt.route && (
                                                  <span className={`badge ${evt.route === 'red' ? 'badge-error' : evt.route === 'yellow' ? 'badge-warning' : 'badge-success'}`}>
                                                      {evt.route.toUpperCase()}
                                                  </span>
                                              )}
                                          </div>
                                          {evt.patient_summary && (
                                              <div className="text-sm mt-1">
                                                  <strong>Patient Summary:</strong> {evt.patient_summary}
                                              </div>
                                          )}
                                          {evt.clinician_summary && (
                                              <div className="text-sm mt-1 bg-base-200 p-1 rounded">
                                                  <strong>Clinician Note:</strong> {evt.clinician_summary}
                                              </div>
                                          )}
                                          {evt.safety_flags && evt.safety_flags.length > 0 && (
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                  {evt.safety_flags.map((flag, i) => (
                                                      <span key={i} className="badge badge-error badge-sm text-white font-bold animate-pulse">
                                                          ⚠️ {flag}
                                                      </span>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  )}
                                  {(evt.notes || evt.description) && (
                                      <div className="mt-2 text-sm bg-base-200 p-2 rounded italic">
                                          "{evt.notes || evt.description}"
                                      </div>
                                  )}
                              </div>
                          </div>
                          <hr/>
                      </li>
                  ))}
              </ul>
          )}
      </div>

      {/* Modal */}
      {showModal && (
          <div className="modal modal-open">
              <div className="modal-box">
                  <h3 className="font-bold text-lg mb-4">Log {modalType === 'symptom' ? 'Symptom' : modalType === 'treatment' ? 'Treatment' : 'Wellness Check'}</h3>
                  
                  <div className="space-y-4">
                      {modalType === 'symptom' && (
                          <>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Symptom Name</span></label>
                                <input type="text" className="input input-bordered" value={symptomName} onChange={e => setSymptomName(e.target.value)} placeholder="e.g. Headache" autoFocus />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Severity (0-10)</span></label>
                                <input type="number" className="input input-bordered" value={severity} onChange={e => setSeverity(e.target.value)} min="0" max="10" />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Trend</span></label>
                                <select className="select select-bordered" value={trend} onChange={e => setTrend(e.target.value)}>
                                    <option value="stable">Stable</option>
                                    <option value="worsening">Worsening</option>
                                    <option value="improving">Improving</option>
                                </select>
                            </div>
                          </>
                      )}
                      
                      {modalType === 'wellness' && (
                          <>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Mood (1-5)</span></label>
                                <div className="rating">
                                    {[1,2,3,4,5].map(v => (
                                        <input key={v} type="radio" name="rating-2" className="mask mask-star-2 bg-orange-400" checked={parseInt(mood) === v} onChange={() => setMood(v.toString())} />
                                    ))}
                                </div>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Anxiety (0-10)</span></label>
                                <input type="range" min="0" max="10" value={anxiety} onChange={e => setAnxiety(e.target.value)} className="range range-xs" /> 
                                <div className="text-center text-xs">{anxiety}/10</div>
                            </div>
                          </>
                      )}

                      {modalType === 'treatment' && (
                          <>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Treatment Name</span></label>
                                <input type="text" className="input input-bordered" value={treatmentName} onChange={e => setTreatmentName(e.target.value)} placeholder="e.g. Chemotherapy Cycle 1" autoFocus />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Date Administered</span></label>
                                <input type="date" className="input input-bordered" value={treatmentDate} onChange={e => setTreatmentDate(e.target.value)} />
                            </div>
                          </>
                      )}

                      <div className="form-control">
                          <label className="label"><span className="label-text">Notes / Description</span></label>
                          <textarea className="textarea textarea-bordered h-24" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..."></textarea>
                      </div>
                  </div>

                  <div className="modal-action">
                      <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleCreateEvent} disabled={createMutation.isPending}>
                          {createMutation.isPending ? <span className="loading loading-spinner loading-xs"></span> : 'Save Event'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Timeline;
