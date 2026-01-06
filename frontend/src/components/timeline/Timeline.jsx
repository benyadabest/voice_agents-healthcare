import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPatientEvents, createEvent, getProfile, deleteEvent, getAnnotations } from '../../api';
import ChartPanel from './ChartPanel';
import FilterBar from './FilterBar';
import AnnotationModal from './AnnotationModal';
import BulkEventModal from './BulkEventModal';

const LIFESTYLE_CATEGORIES = [
  { value: 'diet', label: 'Diet' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'stress', label: 'Stress' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_FILTERS = {
  symptoms: [],
  treatments: [],
  wellness: [],
  lifestyle: [],
  showAllSymptoms: true,
  showAllTreatments: true,
  showAllWellness: true,
  showAllLifestyle: true,
};

const Timeline = ({ patientId }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('symptom'); // symptom, wellness, treatment, lifestyle
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Chart panels state
  const [chartPanels, setChartPanels] = useState([
    { id: 'main', title: 'Health Overview', filters: { ...DEFAULT_FILTERS }, isCollapsed: false }
  ]);

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

  // Lifestyle Fields
  const [lifestyleName, setLifestyleName] = useState("");
  const [lifestyleCategory, setLifestyleCategory] = useState("other");
  const [lifestyleDescription, setLifestyleDescription] = useState("");
  
  // Fetch active profile ID if not provided (fallback)
  const { data: activeProfile } = useQuery({
      queryKey: ['activeProfile'],
      queryFn: getProfile,
      enabled: !patientId,
  });

  const targetId = patientId || activeProfile?.id;

  const { data: eventsData, isLoading: loading } = useQuery({
      queryKey: ['events', targetId],
      queryFn: () => getPatientEvents(targetId),
      enabled: !!targetId,
  });

  const { data: annotationsData } = useQuery({
      queryKey: ['annotations', targetId],
      queryFn: () => getAnnotations(targetId),
      enabled: !!targetId,
  });

  // Ensure data is always arrays
  const events = Array.isArray(eventsData) ? eventsData : [];
  const annotations = Array.isArray(annotationsData) ? annotationsData : [];

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
            symptom_name: symptomName,
            severity: severity ? parseInt(severity) : null,
            trend: trend,
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
    } else if (modalType === 'treatment') {
        if (!treatmentName) {
            alert("Please enter a treatment name.");
            return;
        }
        const timestamp = new Date(treatmentDate).toISOString();
        
        payload = {
            ...baseEvent,
            timestamp: timestamp,
            event_type: "treatment",
            name: treatmentName,
            description: notes
        };
    } else if (modalType === 'lifestyle') {
        if (!lifestyleName) {
            alert("Please enter a name for this lifestyle event.");
            return;
        }
        payload = {
            ...baseEvent,
            event_type: "lifestyle",
            name: lifestyleName,
            category: lifestyleCategory,
            description: lifestyleDescription,
            notes: notes
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
      setLifestyleName("");
      setLifestyleCategory("other");
      setLifestyleDescription("");
  };

  const openModal = (type) => {
      setModalType(type);
      resetForm();
      setShowModal(true);
  };

  // Panel management
  const addChartPanel = () => {
      const newPanel = {
          id: crypto.randomUUID(),
          title: `Chart ${chartPanels.length + 1}`,
          filters: { ...DEFAULT_FILTERS },
          isCollapsed: false
      };
      setChartPanels([...chartPanels, newPanel]);
  };

  const removeChartPanel = (panelId) => {
      if (chartPanels.length <= 1) return;
      setChartPanels(chartPanels.filter(p => p.id !== panelId));
  };

  const updatePanelFilters = (panelId, newFilters) => {
      setChartPanels(chartPanels.map(p => 
          p.id === panelId ? { ...p, filters: newFilters } : p
      ));
  };

  const togglePanelCollapse = (panelId) => {
      setChartPanels(chartPanels.map(p => 
          p.id === panelId ? { ...p, isCollapsed: !p.isCollapsed } : p
      ));
  };

  // Get event type color for timeline
  const getEventTypeColor = (type) => {
    switch (type) {
      case 'symptom': return 'text-primary';
      case 'treatment': return 'text-accent';
      case 'wellness': return 'text-secondary';
      case 'lifestyle': return 'text-info';
      case 'workflow_result': return 'text-warning';
      default: return 'text-gray-500';
    }
  };

  const getEventBorderColor = (evt) => {
    if (evt.event_type === 'treatment') return 'border-accent';
    if (evt.event_type === 'lifestyle') return 'border-info';
    if (evt.event_type === 'workflow_result') {
      if (evt.route === 'red') return 'border-error';
      if (evt.route === 'yellow') return 'border-warning';
      return 'border-success';
    }
    return 'border-base-200';
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-50">
      {/* Header / Actions */}
      <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">Patient Timeline</h2>
          <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => openModal('symptom')}>+ Symptom</button>
              <button className="btn btn-sm btn-secondary" onClick={() => openModal('wellness')}>+ Wellness</button>
              <button className="btn btn-sm btn-accent" onClick={() => openModal('treatment')}>+ Treatment</button>
              <button className="btn btn-sm btn-info" onClick={() => openModal('lifestyle')}>+ Lifestyle</button>
              <div className="divider divider-horizontal mx-1"></div>
              <button 
                className="btn btn-sm btn-ghost gap-1"
                onClick={() => setShowBulkModal(true)}
                title="Add multiple events using AI"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Add
              </button>
              <button 
                className="btn btn-sm btn-ghost gap-1"
                onClick={() => setShowAnnotationModal(true)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Annotate
              </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Chart Panels */}
          {chartPanels.map((panel) => (
              <div key={panel.id}>
                  {/* Filter Bar for this panel */}
                  {!panel.isCollapsed && (
                      <FilterBar
                          patientId={targetId}
                          events={events}
                          filters={panel.filters}
                          onFiltersChange={(newFilters) => updatePanelFilters(panel.id, newFilters)}
                      />
                  )}
                  
                  {/* Chart Panel */}
                  <ChartPanel
                      events={events}
                      annotations={annotations}
                      filters={panel.filters}
                      panelId={panel.id}
                      title={panel.title}
                      isCollapsed={panel.isCollapsed}
                      onToggleCollapse={() => togglePanelCollapse(panel.id)}
                      onRemove={chartPanels.length > 1 ? () => removeChartPanel(panel.id) : null}
                  />
              </div>
          ))}

          {/* Add Chart Button */}
          <button 
              className="btn btn-sm btn-ghost w-full border-dashed border-2 border-gray-300 text-gray-500 hover:border-primary hover:text-primary"
              onClick={addChartPanel}
          >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Chart Panel
          </button>

          {/* Timeline List */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
              <h3 className="font-medium text-gray-700 mb-4">Event History</h3>
              
              {loading ? (
                  <div className="flex justify-center p-4"><span className="loading loading-spinner"></span></div>
              ) : events.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No events recorded yet.</div>
              ) : (
                  <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
                      {events.map((evt, idx) => (
                          <li key={evt.id || idx}>
                              <div className="timeline-middle">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${getEventTypeColor(evt.event_type)}`}>
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                  </svg>
                              </div>
                              <div className="timeline-end mb-10 md:text-start w-full group">
                                  <time className="font-mono italic text-xs opacity-50 flex items-center gap-1">
                                      {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "Unknown Date"}
                                      {evt.source === 'voice' && <span className="badge badge-xs badge-ghost" title="Voice-derived">🎙️</span>}
                                      {evt.source === 'manual' && <span className="badge badge-xs badge-ghost" title="Manual Entry">⌨️</span>}
                                  </time>
                                  <div className="text-sm font-black uppercase tracking-wider mt-1 flex justify-between">
                                      <span>{evt.event_type.replace('_', ' ')}</span>
                                      {evt.confidence !== undefined && evt.confidence < 1.0 && (
                                          <span className="text-xs text-warning" title={`Confidence: ${Math.round(evt.confidence * 100)}%`}>
                                              ⚠️ {(evt.confidence * 100).toFixed(0)}%
                                          </span>
                                      )}
                                  </div>
                                  <div className={`card bg-base-100 shadow-sm border p-3 mt-2 min-w-[300px] relative ${getEventBorderColor(evt)}`}>
                                      <button 
                                        className="btn btn-xs btn-circle btn-ghost absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-error"
                                        onClick={() => handleDeleteEvent(evt.id)}
                                        title="Delete Event"
                                        disabled={deleteMutation.isPending}
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                      </button>

                                      {evt.event_type === 'symptom' && (
                                          <div>
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
                                                  {evt.start_timestamp && evt.end_timestamp ? (
                                                      <span className="badge badge-accent badge-outline">
                                                          {new Date(evt.start_timestamp).toLocaleDateString()} → {new Date(evt.end_timestamp).toLocaleDateString()}
                                                      </span>
                                                  ) : (
                                                      <span className="badge badge-accent badge-outline">
                                                          {new Date(evt.timestamp).toLocaleDateString()}
                                                      </span>
                                                  )}
                                              </div>
                                              {evt.description && (
                                                  <div className="text-xs text-gray-500 mt-1">{evt.description}</div>
                                              )}
                                          </div>
                                      )}
                                      
                                      {evt.event_type === 'lifestyle' && (
                                          <div>
                                              <div className="flex justify-between items-center pr-6">
                                                  <span className="font-bold text-lg text-info">{evt.name}</span>
                                                  <span className="badge badge-info badge-outline capitalize">{evt.category}</span>
                                              </div>
                                              {evt.description && (
                                                  <div className="text-xs text-gray-500 mt-1">{evt.description}</div>
                                              )}
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
                                      
                                      {(evt.notes || (evt.event_type !== 'lifestyle' && evt.description)) && (
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
      </div>

      {/* Event Creation Modal */}
      {showModal && (
          <div className="modal modal-open">
              <div className="modal-box">
                  <h3 className="font-bold text-lg mb-4">
                      Log {modalType === 'symptom' ? 'Symptom' : 
                           modalType === 'treatment' ? 'Treatment' : 
                           modalType === 'lifestyle' ? 'Lifestyle Event' : 
                           'Wellness Check'}
                  </h3>
                  
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

                      {modalType === 'lifestyle' && (
                          <>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Event Name</span></label>
                                <input type="text" className="input input-bordered" value={lifestyleName} onChange={e => setLifestyleName(e.target.value)} placeholder="e.g. Started keto diet" autoFocus />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Category</span></label>
                                <select className="select select-bordered" value={lifestyleCategory} onChange={e => setLifestyleCategory(e.target.value)}>
                                    {LIFESTYLE_CATEGORIES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Description</span></label>
                                <textarea className="textarea textarea-bordered h-20" value={lifestyleDescription} onChange={e => setLifestyleDescription(e.target.value)} placeholder="Describe the lifestyle change or event..."></textarea>
                            </div>
                          </>
                      )}

                      <div className="form-control">
                          <label className="label"><span className="label-text">Notes</span></label>
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

      {/* Annotation Modal */}
      <AnnotationModal
          isOpen={showAnnotationModal}
          onClose={() => setShowAnnotationModal(false)}
          patientId={targetId}
      />

      {/* Bulk Event Modal */}
      <BulkEventModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          patientId={targetId}
      />
    </div>
  );
};

export default Timeline;
