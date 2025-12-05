import React, { useState, useEffect } from 'react';
import { getProfile, saveProfile } from '../api';

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
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (profile.name) {
        setSaving(true);
        try {
          await saveProfile(profile);
          setLastSaved(new Date());
        } catch (error) {
          console.error("Auto-save failed", error);
        } finally {
          setSaving(false);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [profile]);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      if (data) {
        setProfile({ 
            ...initialProfile, 
            ...data,
            measurable_disease: { ...initialProfile.measurable_disease, ...(data.measurable_disease || {}) },
            current_treatment: { ...initialProfile.current_treatment, ...(data.current_treatment || {}) },
            smoking_history: { ...initialProfile.smoking_history, ...(data.smoking_history || {}) },
        });
      }
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNestedChange = (parent, field, value) => {
    setProfile(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (name, value) => {
    setProfile(prev => ({
      ...prev,
      [name]: value.split(',').map(item => item.trim())
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
      
      {/* Left Column: Editor */}
      <div className="card bg-base-100 shadow-xl overflow-y-auto custom-scrollbar">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-base-100 z-10 pb-2 border-b">
             <h2 className="card-title text-sm uppercase tracking-wide text-gray-500">Edit Context</h2>
             <div className="text-xs text-gray-500">
                {saving ? <span className="loading loading-spinner loading-xs"></span> : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Unsaved'}
             </div>
          </div>

          {/* Core Demographics */}
          <div className="collapse collapse-arrow bg-base-200 mb-2">
            <input type="radio" name="accordion" defaultChecked /> 
            <div className="collapse-title text-sm font-bold">Core Demographics</div>
            <div className="collapse-content grid grid-cols-2 gap-2 pt-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Name</span></label>
                <input type="text" name="name" value={profile.name} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Age</span></label>
                <input type="number" name="age" value={profile.age} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Gender</span></label>
                <select name="gender" value={profile.gender} onChange={handleChange} className="select select-sm select-bordered">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
               <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Race</span></label>
                <input type="text" name="race" value={profile.race} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Height</span></label>
                <input type="text" name="height" value={profile.height} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Weight</span></label>
                <input type="text" name="weight" value={profile.weight} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">City</span></label>
                <input type="text" name="city" value={profile.city} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">State</span></label>
                <input type="text" name="state" value={profile.state} onChange={handleChange} className="input input-sm input-bordered" />
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
                <input type="text" name="cancer_type" value={profile.cancer_type} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Diagnosis Date</span></label>
                <input type="date" name="diagnosis_date" value={profile.diagnosis_date} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
              <div className="form-control col-span-2">
                  <label className="cursor-pointer label justify-start gap-2 py-1">
                    <span className="label-text text-xs">First Occurrence?</span>
                    <input type="checkbox" name="first_occurrence" checked={profile.first_occurrence} onChange={handleChange} className="checkbox checkbox-xs" />
                  </label>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Stage</span></label>
                <input type="text" name="stage" value={profile.stage} onChange={handleChange} className="input input-sm input-bordered" />
              </div>
               <div className="form-control col-span-2 border p-2 rounded-lg">
                  <label className="cursor-pointer label justify-start gap-2 py-0">
                      <span className="label-text text-xs font-bold">Measurable Disease?</span>
                      <input type="checkbox" checked={profile.measurable_disease.is_measurable} onChange={(e) => handleNestedChange('measurable_disease', 'is_measurable', e.target.checked)} className="checkbox checkbox-xs" />
                  </label>
                  {profile.measurable_disease.is_measurable && (
                      <textarea className="textarea textarea-xs textarea-bordered mt-1 w-full" placeholder="Description..." value={profile.measurable_disease.description || ''} onChange={(e) => handleNestedChange('measurable_disease', 'description', e.target.value)}></textarea>
                  )}
              </div>
              <div className="form-control col-span-2">
                <label className="label py-1"><span className="label-text text-xs">Tumor Markers Found</span></label>
                <input type="text" value={profile.tumor_markers_found.join(', ')} onChange={(e) => handleArrayChange('tumor_markers_found', e.target.value)} className="input input-sm input-bordered" />
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
                <textarea name="family_history" value={profile.family_history} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-16"></textarea>
              </div>
               <div className="form-control border p-2 rounded-lg">
                  <label className="cursor-pointer label justify-start gap-2 py-0">
                      <span className="label-text text-xs font-bold">Currently on Treatment?</span>
                      <input type="checkbox" checked={profile.current_treatment.is_active} onChange={(e) => handleNestedChange('current_treatment', 'is_active', e.target.checked)} className="checkbox checkbox-xs" />
                  </label>
                  {profile.current_treatment.is_active && (
                      <input type="text" className="input input-xs input-bordered mt-1 w-full" placeholder="Regimen..." value={profile.current_treatment.regimen || ''} onChange={(e) => handleNestedChange('current_treatment', 'regimen', e.target.value)} />
                  )}
              </div>
              <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">ECOG Status</span></label>
                  <select name="ecog_score" value={profile.ecog_score} onChange={handleChange} className="select select-sm select-bordered">
                      <option value="">Select...</option>
                      {[0, 1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
                  </select>
              </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">Medical Records (Text)</span></label>
              <textarea name="medical_records_text" value={profile.medical_records_text} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-32 font-mono"></textarea>
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
                    <input type="number" value={profile.smoking_history.pack_years} onChange={(e) => handleNestedChange('smoking_history', 'pack_years', parseFloat(e.target.value) || 0)} className="input input-sm input-bordered" />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs">Quit Date</span></label>
                    <input type="date" value={profile.smoking_history.quit_date || ''} onChange={(e) => handleNestedChange('smoking_history', 'quit_date', e.target.value)} className="input input-sm input-bordered" />
                  </div>
               </div>
               <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Concerns</span></label>
                <textarea name="concerns" value={profile.concerns} onChange={handleChange} className="textarea textarea-xs textarea-bordered h-16"></textarea>
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
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProfileBuilder;
