import React, { useMemo } from 'react';
import { 
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, ReferenceArea, Scatter
} from 'recharts';

// MyChart-inspired color palette - clean and clinical
const COLORS = {
    primary: '#0066CC',
    secondary: '#5C6BC0',
    accent: '#00897B',
    warning: '#FB8C00',
    error: '#E53935',
    success: '#43A047',
    gray: '#78909C',
};

// Symptom color palette
const SYMPTOM_COLORS = [
    '#0066CC', '#00897B', '#7B1FA2', '#E65100', '#1565C0',
    '#00695C', '#6A1B9A', '#EF6C00', '#0277BD', '#004D40'
];

// Treatment shading colors (pastel)
const TREATMENT_COLORS = [
    { fill: '#E3F2FD', stroke: '#1976D2' },
    { fill: '#E8F5E9', stroke: '#388E3C' },
    { fill: '#FFF3E0', stroke: '#F57C00' },
    { fill: '#F3E5F5', stroke: '#7B1FA2' },
    { fill: '#E0F7FA', stroke: '#00838F' },
];

const ChartPanel = ({ 
    events = [], 
    annotations = [],
    filters,
    onRemove,
    isCollapsed = false,
    onToggleCollapse,
    title = "Health Chart"
}) => {
    // Filter events based on filters
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (event.event_type === 'symptom') {
                if (filters.showAllSymptoms) return true;
                const names = event.measurements?.map(m => m.name) || [event.symptom_name];
                return names.some(name => filters.symptoms?.includes(name));
            }
            if (event.event_type === 'treatment') {
                if (filters.showAllTreatments) return true;
                return filters.treatments?.includes(event.name);
            }
            if (event.event_type === 'wellness') {
                if (filters.showAllWellness) return true;
                return true; // Wellness is always shown if any wellness filter is active
            }
            if (event.event_type === 'lifestyle') {
                if (filters.showAllLifestyle) return true;
                return filters.lifestyle?.includes(event.category);
            }
            return true;
        });
    }, [events, filters]);

    // Process data for chart
    const { chartData, symptomNames, treatmentIntervals } = useMemo(() => {
        const dataMap = new Map();
        const symptoms = new Set();
        const intervals = [];
        const treatmentNameSet = new Set();

        // Collect treatment names for consistent coloring
        filteredEvents
            .filter(e => e.event_type === 'treatment')
            .forEach(e => treatmentNameSet.add(e.name?.split(' ')[0]));
        
        const treatmentNameList = [...treatmentNameSet];
        const getColor = (name) => {
            const baseName = name?.split(' ')[0];
            const idx = treatmentNameList.indexOf(baseName);
            return TREATMENT_COLORS[idx % TREATMENT_COLORS.length];
        };

        filteredEvents.forEach(event => {
            const time = new Date(event.timestamp).getTime();
            
            if (!dataMap.has(time)) {
                dataMap.set(time, {
                    timestamp: time,
                    date: new Date(event.timestamp).toLocaleDateString(),
                });
            }
            
            const point = dataMap.get(time);
            
            if (event.event_type === 'symptom') {
                if (event.measurements?.length > 0) {
                    event.measurements.forEach(m => {
                        if (m.severity?.value != null) {
                            point[m.name] = m.severity.value;
                            point[`${m.name}_trend`] = m.trend;
                            symptoms.add(m.name);
                        }
                    });
                } else if (event.symptom_name && event.severity != null) {
                    point[event.symptom_name] = event.severity;
                    symptoms.add(event.symptom_name);
                }
            }
            
            if (event.event_type === 'wellness') {
                const showMood = filters.showAllWellness || filters.wellness?.includes('Mood');
                const showAnxiety = filters.showAllWellness || filters.wellness?.includes('Anxiety');
                
                if (showMood && event.mood != null) {
                    point['Mood'] = event.mood * 2; // Scale to 0-10
                }
                if (showAnxiety && event.anxiety != null) {
                    point['Anxiety'] = event.anxiety;
                }
            }
            
            if (event.event_type === 'treatment') {
                if (event.start_timestamp && event.end_timestamp) {
                    intervals.push({
                        ...event,
                        color: getColor(event.name)
                    });
                } else {
                    point['Treatment'] = 10;
                    point['_treatmentLabel'] = event.name;
                    point['_treatmentColor'] = getColor(event.name);
                }
            }
            
            if (event.event_type === 'lifestyle') {
                point['Lifestyle'] = 5;
                point['_lifestyleLabel'] = event.name;
                point['_lifestyleCategory'] = event.category;
            }
        });

        return {
            chartData: Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp),
            symptomNames: [...symptoms],
            treatmentIntervals: intervals
        };
    }, [filteredEvents, filters]);

    // Calculate chart domain
    const { minTime, maxTime } = useMemo(() => {
        // When chartData is empty, the component returns early ("No data matches current filters"),
        // so this fallback is effectively unused. Keep it deterministic for linting/purity.
        if (chartData.length === 0) return { minTime: 0, maxTime: 0 };
        const times = chartData.map(d => d.timestamp);
        const min = Math.min(...times);
        const max = Math.max(...times);
        const padding = (max - min) * 0.05 || 86400000;
        return { minTime: min - padding, maxTime: max + padding };
    }, [chartData]);

    // All annotations are now time-range based
    const timeRangeAnnotations = Array.isArray(annotations) ? annotations : [];

    // Custom tooltip - MyChart style
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;

        const activeTreatment = treatmentIntervals.find(t => {
            const start = new Date(t.start_timestamp).getTime();
            const end = new Date(t.end_timestamp).getTime();
            return label >= start && label <= end;
        });

        // Find any active annotations at this time
        const activeAnnotations = timeRangeAnnotations.filter(a => {
            const start = new Date(a.start_timestamp).getTime();
            const end = new Date(a.end_timestamp).getTime();
            return label >= start && label <= end;
        });

        return (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm max-w-xs">
                <p className="font-semibold text-gray-800 border-b border-gray-100 pb-2 mb-2">
                    {new Date(label).toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric'
                    })}
                </p>
                
                {activeTreatment && (
                    <div className="mb-2 px-2 py-1 bg-blue-50 rounded text-xs">
                        <span className="text-blue-700 font-medium">During: </span>
                        <span className="text-blue-900">{activeTreatment.name}</span>
                    </div>
                )}

                {activeAnnotations.length > 0 && (
                    <div className="mb-2 space-y-1">
                        {activeAnnotations.map(ann => (
                            <div 
                                key={ann.id} 
                                className="px-2 py-1 rounded text-xs"
                                style={{ backgroundColor: `${ann.color}20`, borderLeft: `3px solid ${ann.color}` }}
                            >
                                <span className="font-medium">{ann.title}</span>
                                {ann.text && <p className="text-gray-600 mt-0.5">{ann.text}</p>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-1">
                    {payload.map((p, idx) => {
                        if (p.dataKey === 'Treatment') {
                            return (
                                <div key={idx} className="flex items-center gap-2 text-accent">
                                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                                    <span className="font-medium">{p.payload._treatmentLabel}</span>
                                </div>
                            );
                        }
                        if (p.dataKey === 'Lifestyle') {
                            return (
                                <div key={idx} className="flex items-center gap-2 text-info">
                                    <span className="w-2 h-2 rounded-full bg-info"></span>
                                    <span>{p.payload._lifestyleLabel}</span>
                                    <span className="text-xs text-gray-400">({p.payload._lifestyleCategory})</span>
                                </div>
                            );
                        }
                        if (p.dataKey === 'Mood') {
                            return (
                                <div key={idx} className="flex justify-between">
                                    <span className="text-gray-600">Mood</span>
                                    <span className="font-medium">{(p.value / 2).toFixed(0)}/5</span>
                                </div>
                            );
                        }
                        if (p.dataKey === 'Anxiety') {
                            return (
                                <div key={idx} className="flex justify-between">
                                    <span className="text-gray-600">Anxiety</span>
                                    <span className="font-medium">{p.value}/10</span>
                                </div>
                            );
                        }
                        
                        const trend = p.payload[`${p.dataKey}_trend`];
                        return (
                            <div key={idx} className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    <span className="text-gray-600 capitalize">{p.dataKey}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-medium">{p.value}/10</span>
                                    {trend && (
                                        <span className={`text-xs ${
                                            trend === 'improving' ? 'text-green-600' :
                                            trend === 'worsening' ? 'text-red-600' : 'text-gray-400'
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

    if (isCollapsed) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-700">{title}</h3>
                    <div className="flex gap-1">
                        <button 
                            className="btn btn-ghost btn-xs"
                            onClick={onToggleCollapse}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {onRemove && (
                            <button className="btn btn-ghost btn-xs text-error" onClick={onRemove}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-3 text-center">
                <p className="text-gray-400 text-sm">No data matches current filters</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-700">{title}</h3>
                <div className="flex gap-1">
                    <button 
                        className="btn btn-ghost btn-xs"
                        onClick={onToggleCollapse}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    {onRemove && (
                        <button className="btn btn-ghost btn-xs text-error" onClick={onRemove}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        
                        <XAxis 
                            dataKey="timestamp" 
                            type="number" 
                            domain={[minTime, maxTime]}
                            fontSize={11}
                            tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            stroke="#9CA3AF"
                            axisLine={{ stroke: '#E5E7EB' }}
                            tickLine={false}
                        />
                        
                        <YAxis 
                            domain={[0, 10]} 
                            fontSize={11}
                            stroke="#9CA3AF"
                            axisLine={false}
                            tickLine={false}
                            width={30}
                        />

                        {/* Time Range Annotations */}
                        {timeRangeAnnotations.map((ann) => (
                            <ReferenceArea
                                key={ann.id}
                                x1={new Date(ann.start_timestamp).getTime()}
                                x2={new Date(ann.end_timestamp).getTime()}
                                y1={0}
                                y2={10}
                                fill={ann.color || '#3B82F6'}
                                fillOpacity={0.2}
                                stroke={ann.color || '#3B82F6'}
                                strokeWidth={1}
                                strokeDasharray="4 4"
                                label={{
                                    value: ann.title,
                                    position: 'insideTop',
                                    fill: ann.color || '#3B82F6',
                                    fontSize: 10,
                                    fontWeight: 500
                                }}
                            />
                        ))}

                        {/* Treatment Intervals (shaded bands) */}
                        {treatmentIntervals.map((t, idx) => (
                            <ReferenceArea
                                key={t.id || idx}
                                x1={new Date(t.start_timestamp).getTime()}
                                x2={new Date(t.end_timestamp).getTime()}
                                y1={0}
                                y2={10}
                                fill={t.color.fill}
                                fillOpacity={0.6}
                                stroke={t.color.stroke}
                                strokeWidth={1}
                                strokeDasharray="4 2"
                            />
                        ))}

                        <Tooltip content={<CustomTooltip />} />

                        {/* Symptom Lines */}
                        {symptomNames.map((name, idx) => (
                            <React.Fragment key={name}>
                                <Area
                                    type="monotone"
                                    dataKey={name}
                                    fill={SYMPTOM_COLORS[idx % SYMPTOM_COLORS.length]}
                                    fillOpacity={0.1}
                                    stroke="none"
                                    connectNulls
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey={name}
                                    stroke={SYMPTOM_COLORS[idx % SYMPTOM_COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: SYMPTOM_COLORS[idx % SYMPTOM_COLORS.length], strokeWidth: 0 }}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                    connectNulls
                                />
                            </React.Fragment>
                        ))}

                        {/* Wellness Lines (dashed) */}
                        {(filters.showAllWellness || filters.wellness?.includes('Mood')) && (
                            <Line 
                                type="monotone" 
                                dataKey="Mood" 
                                stroke="#EC4899" 
                                strokeDasharray="5 3" 
                                strokeWidth={1.5} 
                                dot={false}
                            />
                        )}
                        {(filters.showAllWellness || filters.wellness?.includes('Anxiety')) && (
                            <Line 
                                type="monotone" 
                                dataKey="Anxiety" 
                                stroke="#A855F7" 
                                strokeDasharray="5 3" 
                                strokeWidth={1.5} 
                                dot={false}
                            />
                        )}

                        {/* Treatment Points */}
                        <Scatter
                            dataKey="Treatment"
                            fill={COLORS.accent}
                            shape={(props) => {
                                const { cx, cy, payload } = props;
                                if (!payload.Treatment) return null;
                                return (
                                    <g>
                                        <circle cx={cx} cy={cy} r={6} fill={payload._treatmentColor?.fill || COLORS.accent} stroke="#fff" strokeWidth={2} />
                                    </g>
                                );
                            }}
                        />

                        {/* Lifestyle Points */}
                        <Scatter
                            dataKey="Lifestyle"
                            fill={COLORS.secondary}
                            shape={(props) => {
                                const { cx, cy, payload } = props;
                                if (!payload.Lifestyle) return null;
                                return (
                                    <rect 
                                        x={cx - 4} 
                                        y={cy - 4} 
                                        width={8} 
                                        height={8} 
                                        fill="#5C6BC0" 
                                        stroke="#fff" 
                                        strokeWidth={2}
                                        rx={1}
                                    />
                                );
                            }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
                {symptomNames.map((name, idx) => (
                    <div key={name} className="flex items-center gap-1">
                        <div 
                            className="w-3 h-0.5 rounded"
                            style={{ backgroundColor: SYMPTOM_COLORS[idx % SYMPTOM_COLORS.length] }}
                        ></div>
                        <span className="text-gray-600 capitalize">{name}</span>
                    </div>
                ))}
                {(filters.showAllWellness || filters.wellness?.length > 0) && (
                    <>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 rounded bg-pink-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #EC4899 0, #EC4899 3px, transparent 3px, transparent 5px)' }}></div>
                            <span className="text-gray-600">Mood</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #A855F7 0, #A855F7 3px, transparent 3px, transparent 5px)' }}></div>
                            <span className="text-gray-600">Anxiety</span>
                        </div>
                    </>
                )}
                {treatmentIntervals.length > 0 && (
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400"></div>
                        <span className="text-gray-600">Treatment Period</span>
                    </div>
                )}
                {timeRangeAnnotations.length > 0 && timeRangeAnnotations.map(ann => (
                    <div key={ann.id} className="flex items-center gap-1">
                        <div 
                            className="w-3 h-3 rounded-sm border"
                            style={{ backgroundColor: `${ann.color}30`, borderColor: ann.color }}
                        ></div>
                        <span className="text-gray-600">{ann.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChartPanel;

