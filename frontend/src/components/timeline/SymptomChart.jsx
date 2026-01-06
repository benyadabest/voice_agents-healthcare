import React from 'react';
import { 
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
    Scatter
} from 'recharts';

// Treatment color palette - distinct colors for different treatment types
const TREATMENT_COLORS = [
    { fill: '#3b82f6', stroke: '#1d4ed8', name: 'blue' },    // Blue
    { fill: '#10b981', stroke: '#059669', name: 'green' },   // Green  
    { fill: '#f59e0b', stroke: '#d97706', name: 'amber' },   // Amber
    { fill: '#8b5cf6', stroke: '#7c3aed', name: 'violet' },  // Violet
    { fill: '#ec4899', stroke: '#db2777', name: 'pink' },    // Pink
];

// Symptom severity color scale
const getSeverityColor = (severity) => {
    if (severity <= 3) return '#22c55e'; // Green - mild
    if (severity <= 6) return '#f59e0b'; // Amber - moderate
    return '#ef4444'; // Red - severe
};

// Tooltip renderer (declared outside render to satisfy react-hooks/static-components)
const SymptomChartTooltip = ({ active, payload, label, intervalTreatments }) => {
    if (!active || !payload || !payload.length) return null;

    // Find if we're in a treatment period
    const hoveredTime = label;
    const activeTreatment = intervalTreatments.find(t => {
        const start = new Date(t.start_timestamp).getTime();
        const end = new Date(t.end_timestamp).getTime();
        return hoveredTime >= start && hoveredTime <= end;
    });

    return (
        <div className="bg-base-100 p-4 border border-base-300 shadow-2xl rounded-lg text-sm max-w-xs">
            <p className="font-bold mb-2 text-base border-b pb-2">
                {new Date(label).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                })}
            </p>
            
            {activeTreatment && (
                <div className="mb-3 p-2 rounded bg-blue-50 border-l-4 border-blue-500">
                    <p className="text-xs font-semibold text-blue-700">During Treatment</p>
                    <p className="text-blue-900 font-medium">{activeTreatment.name}</p>
                </div>
            )}

            <div className="space-y-2">
                {payload.map((p, idx) => {
                    if (p.dataKey === "Treatment") {
                        return (
                            <div key={idx} className="flex items-center gap-2 p-1 rounded bg-red-50">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.payload._treatmentColor?.fill || '#ef4444' }}></div>
                                <div>
                                    <p className="font-semibold text-red-700">Treatment</p>
                                    <p className="text-red-900">{p.payload._treatmentLabel}</p>
                                </div>
                            </div>
                        );
                    }
                    
                    if (p.dataKey === 'Mood') {
                        return (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-lg">😊</span>
                                <div>
                                    <span className="text-gray-600">Mood: </span>
                                    <span className="font-semibold">{p.value / 2}/5</span>
                                </div>
                            </div>
                        );
                    }
                    
                    if (p.dataKey === 'Anxiety') {
                        return (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-lg">😰</span>
                                <div>
                                    <span className="text-gray-600">Anxiety: </span>
                                    <span className="font-semibold">{p.value}/10</span>
                                </div>
                            </div>
                        );
                    }

                    const trend = p.payload[`${p.dataKey}_trend`];
                    const severityColor = getSeverityColor(p.value);
                    
                    return (
                        <div key={idx} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                                <span className="font-medium capitalize">{p.dataKey}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-bold" style={{ color: severityColor }}>{p.value}/10</span>
                                {trend && (
                                    <span className={`text-xs px-1 rounded ${
                                        trend === 'improving' ? 'bg-green-100 text-green-700' :
                                        trend === 'worsening' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {trend === 'improving' ? '↓' : trend === 'worsening' ? '↑' : '→'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Legend renderer (declared outside render to satisfy react-hooks/static-components)
const SymptomChartLegend = ({
    allSymptomNames,
    selectedSymptom,
    setSelectedSymptom,
    getSymptomColor,
    showWellness
}) => (
    <div className="flex flex-wrap gap-3 justify-center mt-2 text-xs">
        {Array.from(allSymptomNames).map((name, idx) => (
            <button 
                key={name}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                    selectedSymptom === name ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ 
                    backgroundColor: `${getSymptomColor(name, idx)}20`,
                    borderColor: getSymptomColor(name, idx)
                }}
                onClick={() => setSelectedSymptom(selectedSymptom === name ? null : name)}
            >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSymptomColor(name, idx) }}></div>
                <span className="capitalize font-medium">{name}</span>
            </button>
        ))}
        {showWellness && (
            <>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-pink-50">
                    <span>😊</span>
                    <span className="font-medium text-pink-700">Mood</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50">
                    <span>😰</span>
                    <span className="font-medium text-purple-700">Anxiety</span>
                </div>
            </>
        )}
    </div>
);

const SymptomChart = ({ events }) => {
    const [showWellness, setShowWellness] = React.useState(true);
    const [showTreatments, setShowTreatments] = React.useState(true);
    const [selectedSymptom, setSelectedSymptom] = React.useState(null);

    // 1. Filter and categorize events
    const symptomEvents = events.filter(e => e.event_type === 'symptom');
    const treatmentEvents = events.filter(e => e.event_type === 'treatment');
    const wellnessEvents = events.filter(e => e.event_type === 'wellness');

    // Separate point treatments from interval treatments
    const pointTreatments = treatmentEvents.filter(t => !t.start_timestamp || !t.end_timestamp);
    const intervalTreatments = treatmentEvents.filter(t => t.start_timestamp && t.end_timestamp);

    // Group treatments by name for consistent coloring
    const treatmentNames = [...new Set(treatmentEvents.map(t => t.name.split(' ')[0]))];
    const getTreatmentColor = (name) => {
        const baseName = name.split(' ')[0];
        const idx = treatmentNames.indexOf(baseName);
        return TREATMENT_COLORS[idx % TREATMENT_COLORS.length];
    };

    if (symptomEvents.length === 0 && wellnessEvents.length === 0 && treatmentEvents.length === 0) {
        return (
            <div className="card bg-base-100 shadow-md p-6 mb-4 border border-base-200 text-center">
                <p className="text-gray-500">No data to display yet. Add symptoms, wellness check-ins, or treatments to see your health timeline.</p>
            </div>
        );
    }

    // 2. Process data into time-series
    const allPointsMap = new Map();
    const allSymptomNames = new Set();

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
                    point[`${m.name}_trend`] = m.trend;
                    allSymptomNames.add(m.name);
                }
            });
        } else if (e.symptom_name && e.severity != null) {
            point[e.symptom_name] = e.severity;
            allSymptomNames.add(e.symptom_name);
        }
    });

    // Process Wellness
    if (showWellness) {
        wellnessEvents.forEach(w => {
            const point = getPoint(w.timestamp);
            if (w.mood !== null) point["Mood"] = w.mood * 2;
            if (w.anxiety !== null) point["Anxiety"] = w.anxiety;
        });
    }

    // Process Point Treatments
    if (showTreatments) {
        pointTreatments.forEach(t => {
            const point = getPoint(t.timestamp);
            point["Treatment"] = 10;
            point["_treatmentLabel"] = t.name;
            point["_treatmentColor"] = getTreatmentColor(t.name);
        });
    }

    const data = Array.from(allPointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Calculate domain for x-axis
    const timestamps = data.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const padding = (maxTime - minTime) * 0.05;

    // Symptom colors - more distinct palette
    const symptomColors = {
        'fatigue': '#6366f1',      // Indigo
        'nausea': '#14b8a6',       // Teal
        'headache': '#f43f5e',     // Rose
        'pain': '#ef4444',         // Red
        'Headache': '#f43f5e',
        'Fatigue': '#6366f1',
        'Nausea': '#14b8a6',
    };
    const defaultColors = ['#6366f1', '#14b8a6', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    const getSymptomColor = (name, index) => {
        return symptomColors[name] || defaultColors[index % defaultColors.length];
    };

    // Calculate trend summary for symptoms
    const getTrendSummary = () => {
        const trends = {};
        symptomEvents.forEach(e => {
            if (e.measurements) {
                e.measurements.forEach(m => {
                    if (m.trend) {
                        if (!trends[m.name]) trends[m.name] = [];
                        trends[m.name].push(m.trend);
                    }
                });
            }
        });
        return Object.entries(trends).map(([name, trendList]) => {
            const latest = trendList[trendList.length - 1];
            return { name, trend: latest };
        });
    };

    const trendSummary = getTrendSummary();

    return (
        <div className="card bg-base-100 shadow-md p-4 mb-4 border border-base-200">
            {/* Header with controls */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Your Health Timeline</h3>
                    <p className="text-xs text-gray-500">Track symptoms, treatments, and wellness over time</p>
                </div>
                <div className="flex gap-3">
                    <label className="label cursor-pointer gap-2">
                        <span className="label-text text-xs font-medium">Wellness</span>
                        <input 
                            type="checkbox" 
                            className="toggle toggle-xs toggle-secondary" 
                            checked={showWellness} 
                            onChange={() => setShowWellness(!showWellness)} 
                        />
                    </label>
                    <label className="label cursor-pointer gap-2">
                        <span className="label-text text-xs font-medium">Treatments</span>
                        <input 
                            type="checkbox" 
                            className="toggle toggle-xs toggle-primary" 
                            checked={showTreatments} 
                            onChange={() => setShowTreatments(!showTreatments)} 
                        />
                    </label>
                </div>
            </div>

            {/* Trend Summary Cards */}
            {trendSummary.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {trendSummary.map(({ name, trend }) => (
                        <div 
                            key={name}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                                trend === 'improving' ? 'bg-green-100 text-green-800 border border-green-200' :
                                trend === 'worsening' ? 'bg-red-100 text-red-800 border border-red-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                        >
                            <span className="capitalize">{name}</span>
                            <span className="text-lg">
                                {trend === 'improving' ? '📉' : trend === 'worsening' ? '📈' : '➡️'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Active Treatment Legend */}
            {showTreatments && intervalTreatments.length > 0 && (
                <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Treatment Periods (Shaded Areas)</p>
                    <div className="flex flex-wrap gap-2">
                        {intervalTreatments.map((t, idx) => {
                            const color = getTreatmentColor(t.name);
                            return (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                    <div 
                                        className="w-4 h-3 rounded-sm opacity-60"
                                        style={{ backgroundColor: color.fill }}
                                    ></div>
                                    <span className="font-medium">{t.name}</span>
                                    <span className="text-gray-500">
                                        ({new Date(t.start_timestamp).toLocaleDateString()} - {new Date(t.end_timestamp).toLocaleDateString()})
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            {/* Gradient definitions for symptoms */}
                            {Array.from(allSymptomNames).map((name, idx) => (
                                <linearGradient key={name} id={`gradient-${name}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getSymptomColor(name, idx)} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={getSymptomColor(name, idx)} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        
                        <XAxis 
                            dataKey="timestamp" 
                            type="number" 
                            domain={[minTime - padding, maxTime + padding]}
                            fontSize={11}
                            tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            stroke="#9ca3af"
                        />
                        
                        <YAxis 
                            domain={[0, 10]} 
                            fontSize={11}
                            stroke="#9ca3af"
                            tickFormatter={(val) => val}
                            label={{ 
                                value: 'Severity', 
                                angle: -90, 
                                position: 'insideLeft',
                                style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 11 }
                            }} 
                        />

                        {/* Treatment Interval Shaded Areas - render first so they're behind */}
                        {showTreatments && intervalTreatments.map((treatment, idx) => {
                            const startTime = new Date(treatment.start_timestamp).getTime();
                            const endTime = new Date(treatment.end_timestamp).getTime();
                            const color = getTreatmentColor(treatment.name);
                            return (
                                <ReferenceArea
                                    key={`interval-${treatment.id || idx}`}
                                    x1={startTime}
                                    x2={endTime}
                                    y1={0}
                                    y2={10}
                                    fill={color.fill}
                                    fillOpacity={0.15}
                                    stroke={color.stroke}
                                    strokeWidth={2}
                                    strokeOpacity={0.5}
                                />
                            );
                        })}

                        {/* Reference lines at severity thresholds */}
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />

                        <Tooltip content={(props) => <SymptomChartTooltip {...props} intervalTreatments={intervalTreatments} />} />
                        
                        {/* Symptom Area + Lines */}
                        {Array.from(allSymptomNames).map((name, index) => (
                            <React.Fragment key={name}>
                                <Area
                                    type="monotone"
                                    dataKey={name}
                                    fill={`url(#gradient-${name})`}
                                    stroke="none"
                                    connectNulls
                                    opacity={selectedSymptom && selectedSymptom !== name ? 0.2 : 1}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey={name} 
                                    stroke={getSymptomColor(name, index)}
                                    strokeWidth={selectedSymptom === name ? 3 : 2}
                                    dot={{ r: 4, fill: getSymptomColor(name, index), strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                                    connectNulls
                                    opacity={selectedSymptom && selectedSymptom !== name ? 0.3 : 1}
                                />
                            </React.Fragment>
                        ))}

                        {/* Wellness Lines */}
                        {showWellness && (
                            <>
                                <Line 
                                    type="monotone" 
                                    dataKey="Mood" 
                                    stroke="#ec4899" 
                                    strokeDasharray="5 5" 
                                    strokeWidth={2} 
                                    dot={false}
                                    opacity={0.7}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="Anxiety" 
                                    stroke="#a855f7" 
                                    strokeDasharray="5 5" 
                                    strokeWidth={2} 
                                    dot={false}
                                    opacity={0.7}
                                />
                            </>
                        )}

                        {/* Point Treatment Markers */}
                        {showTreatments && pointTreatments.length > 0 && (
                            <Scatter
                                dataKey="Treatment"
                                fill="#ef4444"
                                shape={(props) => {
                                    const { cx, cy, payload } = props;
                                    const color = payload._treatmentColor || { fill: '#ef4444' };
                                    return (
                                        <g>
                                            <circle cx={cx} cy={cy} r={8} fill={color.fill} stroke="#fff" strokeWidth={2} />
                                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={10} fontWeight="bold">
                                                💊
                                            </text>
                                        </g>
                                    );
                                }}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Legend */}
            <SymptomChartLegend
                allSymptomNames={allSymptomNames}
                selectedSymptom={selectedSymptom}
                setSelectedSymptom={setSelectedSymptom}
                getSymptomColor={getSymptomColor}
                showWellness={showWellness}
            />

            {/* Severity Guide */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex justify-center items-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-green-500 rounded"></div>
                        <span>Mild (0-3)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-amber-500 rounded"></div>
                        <span>Moderate (4-6)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-red-500 rounded"></div>
                        <span>Severe (7-10)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SymptomChart;
