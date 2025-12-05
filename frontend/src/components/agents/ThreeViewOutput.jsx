import React from 'react';

const ThreeViewOutput = ({ transcript, analysis }) => {
  if (!analysis) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Column 1: Transcript */}
      <div className="card bg-base-100 shadow-lg overflow-y-auto custom-scrollbar h-96 md:h-auto">
        <div className="card-body p-4">
          <h3 className="card-title text-sm uppercase text-gray-500">Transcript</h3>
          <p className="whitespace-pre-wrap text-sm font-serif">{transcript || "No transcript available."}</p>
        </div>
      </div>

      {/* Column 2: Structured JSON */}
      <div className="card bg-neutral text-neutral-content shadow-lg overflow-y-auto custom-scrollbar h-96 md:h-auto">
        <div className="card-body p-4">
          <h3 className="card-title text-sm uppercase text-gray-400">Structured Data (JSON)</h3>
          <pre className="text-xs font-mono">{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      </div>

      {/* Column 3: Human Readable Insights */}
      <div className="card bg-base-100 shadow-lg overflow-y-auto custom-scrollbar h-96 md:h-auto">
        <div className="card-body p-4">
          <h3 className="card-title text-sm uppercase text-primary">Insights & Takeaways</h3>
          
          {/* Chief Complaint */}
          {analysis.chief_complaint && (
            <div className="mb-4">
              <span className="badge badge-primary badge-outline mb-1">Chief Complaint</span>
              <p className="text-lg font-medium">{analysis.chief_complaint}</p>
            </div>
          )}

          {/* Safety Flags */}
          {analysis.safety_flags && (
             <div className="mb-4">
                 <span className={`badge ${analysis.safety_flags.recommendation_level === 'red' ? 'badge-error' : analysis.safety_flags.recommendation_level === 'yellow' ? 'badge-warning' : 'badge-success'} mb-1`}>
                    Triage Recommendation: {analysis.safety_flags.recommendation_level.toUpperCase()}
                 </span>
                 {analysis.safety_flags.red_flag_present && <p className="text-error text-sm font-bold">RED FLAGS DETECTED</p>}
             </div>
          )}

          {/* Symptoms List */}
          {analysis.symptom_observations && analysis.symptom_observations.length > 0 && (
            <div className="mb-4">
                <h4 className="font-bold text-sm mb-2">Symptoms Identified</h4>
                <ul className="space-y-2">
                    {analysis.symptom_observations.map((sym, idx) => (
                        <li key={idx} className="bg-base-200 p-2 rounded-md text-sm">
                            <div className="flex justify-between">
                                <span className="font-bold capitalize">{sym.name}</span>
                                {sym.severity_0_10 && <span className="badge badge-sm">{sym.severity_0_10}/10</span>}
                            </div>
                            {sym.trend && <div className="text-xs text-gray-500">Trend: {sym.trend}</div>}
                            {sym.functional_impact && <div className="text-xs italic mt-1">"{sym.functional_impact}"</div>}
                        </li>
                    ))}
                </ul>
            </div>
          )}

          {/* Wellness / Goals */}
          {analysis.goals && (
             <div className="mb-4">
                <h4 className="font-bold text-sm mb-2">Goals</h4>
                <div className="bg-info/10 p-2 rounded-md text-sm border-l-4 border-info">
                    {analysis.goals}
                </div>
             </div>
          )}
           {analysis.mood && (
             <div className="mb-4">
                <h4 className="font-bold text-sm mb-2">Mood</h4>
                <div className="bg-base-200 p-2 rounded-md text-sm">
                    {analysis.mood}
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ThreeViewOutput;

