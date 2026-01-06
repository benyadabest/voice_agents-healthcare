import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProfileBuilder from './components/ProfileBuilder';
import HealthChat from './components/agents/HealthChat';
import Timeline from './components/timeline/Timeline';
import { getProfile } from './api';

function App() {
  const [currentView, setCurrentView] = useState('profile');

  // React Query to fetch active profile ID
  // Runs every time active profile changes (handled by query invalidation elsewhere)
  const { data: activeProfile } = useQuery({
    queryKey: ['activeProfile'],
    queryFn: getProfile,
    refetchInterval: 2000, // Keep polling for now as backend active ID might change from other tabs, or remove if we rely on optimistic UI
  });

  const currentPatientId = activeProfile?.id;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg z-20">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">Oncology RPM Console</a>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li>
                <button 
                    className={`btn btn-ghost ${currentView === 'profile' ? 'btn-active' : ''}`} 
                    onClick={() => setCurrentView('profile')}
                >
                    Patient Profile
                </button>
            </li>
            <li>
                <button 
                    className={`btn btn-ghost ${currentView === 'agents' ? 'btn-active' : ''}`} 
                    onClick={() => setCurrentView('agents')}
                >
                    Health Chat
                </button>
            </li>
            <li>
                <button 
                    className={`btn btn-ghost ${currentView === 'timeline' ? 'btn-active' : ''}`} 
                    onClick={() => setCurrentView('timeline')}
                >
                    Timeline
                </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 flex-1 min-h-0">
        {currentView === 'profile' && <ProfileBuilder />}
        {currentView === 'agents' && <HealthChat patientId={currentPatientId} />}
        {currentView === 'timeline' && <Timeline patientId={currentPatientId} />}
      </div>
    </div>
  );
}

export default App;
