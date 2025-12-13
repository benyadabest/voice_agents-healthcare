import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SymptomChart = ({ events }) => {
  const [showWellness, setShowWellness] = React.useState(true);
  const [showTreatments, setShowTreatments] = React.useState(true);

  // 1. Filter events
  const symptomEvents = events.filter(e => e.event_type === 'symptom');
  const treatmentEvents = events.filter(e => e.event_type === 'treatment');
  const wellnessEvents = events.filter(e => e.event_type === 'wellness');

  if (symptomEvents.length === 0 && wellnessEvents.length === 0) return null;

  // 2. Process data: Merge all events into a single time-series map
  const allPointsMap = new Map();
  const allSymptomNames = new Set();

  // Helper to get or create point
  const getPoint = (timestamp) => {
      const time = new Date(timestamp).getTime();
      if (!allPointsMap.has(time)) {
          allPointsMap.set(time, {
              timestamp: time,
              formattedDate: new Date(timestamp).toLocaleString(),
          });
      }
      return allPointsMap.get(time);
  };

  // Process Symptoms
  symptomEvents.forEach(e => {
      const point = getPoint(e.timestamp);
      
      if (e.measurements && e.measurements.length > 0) {
          e.measurements.forEach(m => {
              if (m.severity?.value != null) {
                  point[m.name] = m.severity.value;
                  allSymptomNames.add(m.name);
              }
          });
      } else if (e.symptom_name && e.severity != null) {
          point[e.symptom_name] = e.severity;
          allSymptomNames.add(e.symptom_name);
      }
  });

  // Process Wellness (Mood/Anxiety)
  if (showWellness) {
      wellnessEvents.forEach(w => {
          const point = getPoint(w.timestamp);
          if (w.mood !== null) point["Mood"] = w.mood * 2; // Scale 1-5 to 0-10 for chart
          if (w.anxiety !== null) point["Anxiety"] = w.anxiety;
      });
  }

  // Process Treatments (Add as data points)
  if (showTreatments) {
      treatmentEvents.forEach(t => {
          const point = getPoint(t.timestamp);
          // We assign a value (e.g. 10) so it plots high on the chart, or 0.
          // But mostly we want the data payload for the tooltip.
          point["Treatment"] = 10; 
          point["_treatmentLabel"] = t.name;
      });
  }

  const data = Array.from(allPointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // Colors for lines
  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#ff0000"];

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-base-100 p-3 border border-base-300 shadow-xl rounded text-xs z-50">
                  <p className="font-bold mb-2 border-b pb-1">{new Date(label).toLocaleString()}</p>
                  {payload.map((p, idx) => {
                      if (p.dataKey === "Treatment") {
                          return (
                              <div key={idx} className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                                  <p className="font-bold text-accent">
                                      Treatment: {p.payload._treatmentLabel}
                                  </p>
                              </div>
                          );
                      }
                      return (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                              <p style={{ color: p.color }}>
                                  {p.name}: {p.name === 'Mood' ? `${p.value / 2}/5` : `${p.value}/10`}
                              </p>
                          </div>
                      );
                  })}
              </div>
          );
      }
      return null;
  };

  return (
    <div className="card bg-base-100 shadow-md p-4 mb-4 border border-base-200">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">History & Trends</h3>
            <div className="flex gap-2">
                <label className="label cursor-pointer gap-2">
                    <span className="label-text text-xs">Wellness</span>
                    <input type="checkbox" className="toggle toggle-xs toggle-secondary" checked={showWellness} onChange={() => setShowWellness(!showWellness)} />
                </label>
                <label className="label cursor-pointer gap-2">
                    <span className="label-text text-xs">Treatments</span>
                    <input type="checkbox" className="toggle toggle-xs toggle-accent" checked={showTreatments} onChange={() => setShowTreatments(!showTreatments)} />
                </label>
            </div>
        </div>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="timestamp" 
                        type="number" 
                        domain={['auto', 'auto']} 
                        fontSize={10} 
                        tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                    />
                    <YAxis domain={[0, 10]} fontSize={10} label={{ value: 'Severity (0-10)', angle: -90, position: 'insideLeft' }} />
                    
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    {/* Symptom Lines */}
                    {Array.from(allSymptomNames).map((name, index) => (
                        <Line 
                            key={name} 
                            type="monotone" 
                            dataKey={name} 
                            stroke={colors[index % colors.length]} 
                            activeDot={{ r: 6 }} 
                            strokeWidth={2}
                            connectNulls
                        />
                    ))}

                    {/* Wellness Lines (Dashed) */}
                    {showWellness && (
                        <>
                            <Line type="monotone" dataKey="Mood" stroke="#ec4899" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Anxiety" stroke="#a855f7" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                        </>
                    )}

                    {/* Treatment "Line" (Dots only) */}
                    {showTreatments && (
                        <Line 
                            type="monotone" 
                            dataKey="Treatment" 
                            stroke="none" 
                            legendType="circle"
                            dot={{ r: 6, fill: "#ef4444", strokeWidth: 0 }}
                            activeDot={{ r: 8, stroke: "#ef4444", strokeWidth: 2, fill: "white" }}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};

export default SymptomChart;
