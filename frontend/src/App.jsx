import React, { useState } from 'react';
import ProfileBuilder from './components/ProfileBuilder';
import VoiceAgents from './components/agents/VoiceAgents';

function App() {
  const [currentView, setCurrentView] = useState('profile');

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
                <a 
                    className={currentView === 'profile' ? 'active' : ''} 
                    onClick={() => setCurrentView('profile')}
                >
                    Patient Profile
                </a>
            </li>
            <li>
                <a 
                    className={currentView === 'agents' ? 'active' : ''} 
                    onClick={() => setCurrentView('agents')}
                >
                    Voice Agents
                </a>
            </li>
            <li><a className="disabled">Timeline</a></li>
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 flex-1 min-h-0">
        {currentView === 'profile' && <ProfileBuilder />}
        {currentView === 'agents' && <VoiceAgents />}
      </div>
    </div>
  );
}

export default App;
