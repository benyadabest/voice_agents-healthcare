import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, saveProfile, getProfiles, switchProfile, createNewProfile, deleteProfile, generateProfileFromDescription } from '../api';

const initialProfile = {
  name: 'John Doe',
  age: 58,
  gender: 'Male',
  race: 'Caucasian',
  height: '5\'10"',
  weight: '175 lbs',
  city: 'Boston',
  state: 'MA',
  cancer_type: 'Lung Adenocarcinoma',
  diagnosis_date: '2024-01-15',
  first_occurrence: true,
  stage: 'IIIB',
  measurable_disease: { is_measurable: true, description: 'Right upper lobe mass, 4.2cm' },
  tumor_markers_found: ['CEA', 'PD-L1 > 50%'],
  tumor_markers_ruled_out: ['EGFR', 'ALK'],
  family_history: 'Father: Lung Cancer (Smoker)\nMother: No cancer history',
  prior_therapies: [],
  current_treatment: { is_active: true, regimen: 'Carboplatin + Pemetrexed + Pembrolizumab' },
  ecog_score: '1',
  smoking_history: { pack_years: 30, quit_date: '2023-12-01' },
  alcohol_consumption: 'Occasional social drinker',
  concerns: 'Worried about side effects interfering with work. Shortness of breath when walking stairs.',
  prognosis_preference: 'neutral',
  medical_records_text: 'CT Chest (2024-01-15): 4.2cm spulated mass in RUL. Enlarged right hilar lymph nodes. No distant mets.\nBiopsy: Adenocarcinoma, TTF-1 positive.'
};

const ProfileBuilder = () => {
  const queryClient = useQueryClient();
  const [localProfile, setLocalProfile] = useState(initialProfile);
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [useAIGeneration, setUseAIGeneration] = useState(false);
  const [patientDescription, setPatientDescription] = useState("");
  const [monthsOfHistory, setMonthsOfHistory] = useState(6);

  // Queries
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    onSuccess: (data) => {
        if (data) {
            setLocalProfile({
                ...initialProfile,
                ...data,
                measurable_disease: { ...initialProfile.measurable_disease, ...(data.measurable_disease || {}) },
                current_treatment: { ...initialProfile.current_treatment, ...(data.current_treatment || {}) },
                smoking_history: { ...initialProfile.smoking_history, ...(data.smoking_history || {}) },
            });
        }
    }
  });

  // Sync local state when server data arrives (if different ID to prevent overwrite while typing)
  React.useEffect(() => {
      if (profile && profile.id !== localProfile.id) {
          setLocalProfile({
            ...initialProfile,
            ...profile,
            measurable_disease: { ...initialProfile.measurable_disease, ...(profile.measurable_disease || {}) },
            current_treatment: { ...initialProfile.current_treatment, ...(profile.current_treatment || {}) },
            smoking_history: { ...initialProfile.smoking_history, ...(profile.smoking_history || {}) },
        });
      }
  }, [profile]);

  const { data: profilesList = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    }
  });

  const switchMutation = useMutation({
    mutationFn: switchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      // We rely on the useEffect above to update local state when new profile fetches
    }
  });

  const createMutation = useMutation({
    mutationFn: createNewProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setShowNewProfileModal(false);
      setNewProfileName("");
      setUseAIGeneration(false);
      setPatientDescription("");
    }
  });

  const generateMutation = useMutation({
    mutationFn: ({ description, name, monthsOfHistory }) => generateProfileFromDescription(description, name, monthsOfHistory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowNewProfileModal(false);
      setNewProfileName("");
      setUseAIGeneration(false);
      setPatientDescription("");
      setMonthsOfHistory(6);
    },
    onError: (error) => {
      console.error("Failed to generate profile:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Failed to generate profile. Please check your API key and try again.";
      alert(`Error: ${errorMessage}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    }
  });

  // Auto-save effect (Debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only save if dirty and valid ID
      if (localProfile.id && localProfile.id !== 'default') {
         // Simple check: Don't save if it matches the server state exactly (optimization)
         // For now, just save
         if (!isProfileLoading) {
             saveMutation.mutate(localProfile);
         }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [localProfile]);


  const handleSwitchProfile = (id) => {
      switchMutation.mutate(id);
  };

  const handleCreateProfile = () => {
      if (useAIGeneration) {
          if (!patientDescription.trim()) {
              alert("Please provide a patient description for AI generation.");
              return;
          }
          generateMutation.mutate({
              description: patientDescription,
              name: newProfileName.trim() || undefined,
              monthsOfHistory: monthsOfHistory
          });
      } else {
          if (!newProfileName.trim()) return;
          createMutation.mutate(newProfileName);
      }
  };

  const handleDeleteProfile = () => {
      if (!localProfile.id) return;
      if (!window.confirm(`Are you sure you want to delete ${localProfile.name}? This cannot be undone.`)) return;
      deleteMutation.mutate(localProfile.id);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalProfile(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNestedChange = (parent, field, value) => {
    setLocalProfile(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (name, value) => {
    setLocalProfile(prev => ({
      ...prev,
      [name]: value.split(',').map(item => item.trim())
    }));
  };

  if (isProfileLoading && !localProfile.id) return <div className="p-10 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
      
      {/* Left Column: Editor */}
      <div className="card bg-base-100 shadow-xl overflow-y-auto custom-scrollbar flex flex-col">
        {/* Profile Selector Header */}
        <div className="p-4 border-b bg-base-200 flex justify-between items-center sticky top-0 z-20">
            <div className="flex items-center gap-2">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-sm btn-ghost m-1 font-bold text-lg">
                        {localProfile.name} <span className="text-xs font-normal opacity-50">▼</span>
                    </div>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        {profilesList.map(p => (
                            <li key={p.id}>
                                <a className={p.id === localProfile.id ? 'active' : ''} onClick={() => handleSwitchProfile(p.id)}>
                                    {p.name}
                                </a>
                            </li>
                        ))}
                        <div className="divider my-1"></div> 
                        <li><a onClick={() => setShowNewProfileModal(true)}>+ Create New Profile</a></li>
                    </ul>
                </div>
                {profilesList.length > 1 && (
                    <button className="btn btn-xs btn-ghost text-error" onClick={handleDeleteProfile} title="Delete Profile" disabled={deleteMutation.isPending}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                )}
            </div>
            <div className="text-xs text-gray-500">
                {saveMutation.isPending ? <span className="loading loading-spinner loading-xs"></span> : `Saved`}
            </div>
        </div>

        <div className="card-body pt-4">
          <div className="flex justify-between items-center mb-4">
             <h2 className="card-title text-sm uppercase tracking-wide text-gray-500">Edit Context</h2>
          </div>

          {/* Core Demographics */}
          <div className="collapse collapse-arrow bg-base-200 mb-2">
            <input type="radio" name="accordion" defaultChecked /> 
            <div className="collapse-title text-sm font-bold">Core Demographics</div>
            <div className="collapse-content grid grid-cols-2 gap-2 pt-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Name</span></label>
                <input type="text" name="name" value={localProfile.name} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Age</span></label>
                <input type="number" name="age" value={localProfile.age} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Gender</span></label>
                <select name="gender" value={localProfile.gender} onChange={handleChange} className="select select-sm select-bordered">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
               <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Race</span></label>
                <input type="text" name="race" value={localProfile.race} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Height</span></label>
                <input type="text" name="height" value={localProfile.height} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Weight</span></label>
                <input type="text" name="weight" value={localProfile.weight} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">City</span></label>
                <input type="text" name="city" value={localProfile.city} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">State</span></label>
                <input type="text" name="state" value={localProfile.state} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
            </div>
          </div>

          {/* Cancer Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-2">
            <input type="radio" name="accordion" /> 
            <div className="collapse-title text-sm font-bold">Cancer Information</div>
            <div className="collapse-content grid grid-cols-2 gap-2 pt-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Type</span></label>
                <input type="text" name="cancer_type" value={localProfile.cancer_type} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Diagnosis Date</span></label>
                <input type="date" name="diagnosis_date" value={localProfile.diagnosis_date} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control col-span-2">
                  <label className="cursor-pointer label justify-start gap-2 py-1">
                    <span className="label-text text-xs">First Occurrence?</span>
                    <input type="checkbox" name="first_occurrence" checked={localProfile.first_occurrence} onChange={handleChange} className="checkbox checkbox-xs" />
                  </label>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Stage</span></label>
                <input type="text" name="stage" value={localProfile.stage} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
               <div className="form-control col-span-2 border p-2 rounded-lg">
                  <label className="cursor-pointer label justify-start gap-2 py-0">
                      <span className="label-text text-xs font-bold">Measurable Disease?</span>
                      <input type="checkbox" checked={localProfile.measurable_disease.is_measurable} onChange={(e) => handleNestedChange('measurable_disease', 'is_measurable', e.target.checked)} className="checkbox checkbox-xs" />
                  </label>
                  {localProfile.measurable_disease.is_measurable && (
                      <textarea className="textarea textarea-xs textarea-bordered mt-1 w-full" placeholder="Description..." value={localProfile.measurable_disease.description || ''} onChange={(e) => handleNestedChange('measurable_disease', 'description', e.target.value)}></textarea>
                  )}
              </div>
              <div className="form-control col-span-2">
                <label className="label py-1"><span className="label-text text-xs">Tumor Markers Found</span></label>
                <input type="text" value={localProfile.tumor_markers_found.join(', ')} onChange={(e) => handleArrayChange('tumor_markers_found', e.target.value)} className="input input-sm input-bordered" />
              </div>
              <div className="form-control col-span-2">
                <label className="label py-1"><span className="label-text text-xs">Tumor Markers Ruled Out</span></label>
                <input type="text" value={localProfile.tumor_markers_ruled_out.join(', ')} onChange={(e) => handleArrayChange('tumor_markers_ruled_out', e.target.value)} className="input input-sm input-bordered" />
              </div>
            </div>
          </div>

          {/* Medical History */}
           <div className="collapse collapse-arrow bg-base-200 mb-2">
            <input type="radio" name="accordion" /> 
            <div className="collapse-title text-sm font-bold">Medical History</div>
            <div className="collapse-content grid grid-cols-1 gap-2 pt-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Family History</span></label>
                <textarea name="family_history" value={localProfile.family_history} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-16"></textarea>
              </div>
               <div className="form-control border p-2 rounded-lg">
                  <label className="cursor-pointer label justify-start gap-2 py-0">
                      <span className="label-text text-xs font-bold">Currently on Treatment?</span>
                      <input type="checkbox" checked={localProfile.current_treatment.is_active} onChange={(e) => handleNestedChange('current_treatment', 'is_active', e.target.checked)} className="checkbox checkbox-xs" />
                  </label>
                  {localProfile.current_treatment.is_active && (
                      <input type="text" className="input input-xs input-bordered mt-1 w-full" placeholder="Regimen..." value={localProfile.current_treatment.regimen || ''} onChange={(e) => handleNestedChange('current_treatment', 'regimen', e.target.value)} />
                  )}
              </div>
              <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">ECOG Status</span></label>
                  <select name="ecog_score" value={localProfile.ecog_score} onChange={handleChange} className="select select-sm select-bordered">
                      <option value="">Select...</option>
                      {[0, 1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
                  </select>
              </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Medical Records (Text)</span></label>
              <textarea name="medical_records_text" value={localProfile.medical_records_text} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-32 font-mono"></textarea>
            </div>
          </div>
        </div>
         
         {/* Lifestyle & Prefs */}
           <div className="collapse collapse-arrow bg-base-200 mb-2">
            <input type="radio" name="accordion" /> 
            <div className="collapse-title text-sm font-bold">Lifestyle & Preferences</div>
            <div className="collapse-content grid grid-cols-1 gap-2 pt-2">
               <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs">Pack-Years</span></label>
                    <input type="number" value={localProfile.smoking_history.pack_years} onChange={(e) => handleNestedChange('smoking_history', 'pack_years', parseFloat(e.target.value) || 0)} className="input input-sm input-bordered" />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs">Quit Date</span></label>
                    <input type="date" value={localProfile.smoking_history.quit_date || ''} onChange={(e) => handleNestedChange('smoking_history', 'quit_date', e.target.value)} className="input input-sm input-bordered" />
                  </div>
               </div>
               <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Alcohol Consumption</span></label>
                <input type="text" name="alcohol_consumption" value={localProfile.alcohol_consumption} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
               <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Concerns</span></label>
                <textarea name="concerns" value={localProfile.concerns} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-16"></textarea>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Right Column: Live JSON View */}
      <div className="card bg-neutral text-neutral-content shadow-xl overflow-hidden h-full">
        <div className="card-body p-0 flex flex-col h-full">
          <div className="bg-gray-800 p-4 border-b border-gray-700 flex-none">
            <h2 className="card-title text-sm text-white">Live Patient Context (JSON)</h2>
          </div>
          <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
            <pre className="text-xs font-mono leading-relaxed">
              {JSON.stringify(localProfile, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Create New Profile Modal */}
      {showNewProfileModal && (
          <div className="modal modal-open">
              <div className="modal-box max-w-2xl">
                  <h3 className="font-bold text-lg">Create New Profile</h3>
                  
                  <div className="form-control w-full mt-4">
                      <label className="label cursor-pointer justify-start gap-2">
                          <input 
                            type="checkbox" 
                            className="checkbox checkbox-primary" 
                            checked={useAIGeneration}
                            onChange={(e) => setUseAIGeneration(e.target.checked)}
                          />
                          <span className="label-text font-semibold">Generate with AI (describe patient)</span>
                      </label>
                  </div>

                  {useAIGeneration ? (
                      <>
                          <div className="form-control w-full mt-4">
                              <label className="label"><span className="label-text">Patient Name (Optional)</span></label>
                              <input 
                                type="text" 
                                className="input input-bordered w-full" 
                                placeholder="e.g. Jane Doe (leave blank to auto-generate)"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                              />
                          </div>
                          <div className="form-control w-full mt-4">
                              <label className="label"><span className="label-text">Patient Description</span></label>
                              <textarea 
                                className="textarea textarea-bordered h-32" 
                                placeholder="Describe the patient: diagnosis, stage, treatment regimen, notable symptoms, lifestyle, concerns, etc. Example: '65-year-old female with Stage IIIB lung adenocarcinoma, currently on Carboplatin + Pemetrexed. Experiencing fatigue and occasional nausea. Former smoker, quit 5 years ago. Concerned about treatment side effects affecting daily activities.'"
                                value={patientDescription}
                                onChange={(e) => setPatientDescription(e.target.value)}
                                autoFocus
                              />
                          </div>
                          <div className="form-control w-full mt-2">
                              <label className="label"><span className="label-text">Months of History to Generate</span></label>
                              <input 
                                type="number" 
                                className="input input-bordered w-full" 
                                min="1" 
                                max="24" 
                                value={monthsOfHistory}
                                onChange={(e) => setMonthsOfHistory(parseInt(e.target.value) || 6)}
                              />
                          </div>
                      </>
                  ) : (
                      <div className="form-control w-full mt-4">
                          <label className="label"><span className="label-text">Patient Name</span></label>
                          <input 
                            type="text" 
                            className="input input-bordered w-full" 
                            placeholder="e.g. Jane Doe"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            autoFocus
                          />
                      </div>
                  )}

                  <div className="modal-action">
                      <button className="btn" onClick={() => {
                          setShowNewProfileModal(false);
                          setUseAIGeneration(false);
                          setPatientDescription("");
                          setNewProfileName("");
                      }}>Cancel</button>
                      <button 
                        className="btn btn-primary" 
                        onClick={handleCreateProfile}
                        disabled={createMutation.isPending || generateMutation.isPending}
                      >
                          {(createMutation.isPending || generateMutation.isPending) ? (
                              <>
                                  <span className="loading loading-spinner loading-xs"></span>
                                  {useAIGeneration ? 'Generating...' : 'Creating...'}
                              </>
                          ) : (
                              useAIGeneration ? 'Generate with AI' : 'Create'
                          )}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ProfileBuilder;
