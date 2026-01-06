import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSavedViews, createSavedView, deleteSavedView } from '../../api';

const FilterDropdown = ({
    title,
    items,
    category,
    showAll,
    selectedItems,
    color,
    onToggleAll,
    onToggleItem
}) => (
    <div className="dropdown dropdown-hover">
        <label tabIndex={0} className={`btn btn-sm gap-1 ${color}`}>
            {title}
            <span className="badge badge-sm badge-ghost">
                {showAll ? 'All' : selectedItems.length || 0}
            </span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </label>
        <ul tabIndex={0} className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-lg w-56 border border-base-200">
            <li>
                <label className="label cursor-pointer justify-start gap-2">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={showAll}
                        onChange={() => onToggleAll(category, showAll)}
                    />
                    <span className="font-medium">Show All</span>
                </label>
            </li>
            <div className="divider my-0"></div>
            {items.map(item => (
                <li key={item}>
                    <label className="label cursor-pointer justify-start gap-2">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={showAll || selectedItems.includes(item)}
                            onChange={() => onToggleItem(category, item)}
                            disabled={showAll}
                        />
                        <span className="text-sm">{item}</span>
                    </label>
                </li>
            ))}
            {items.length === 0 && (
                <li className="text-xs text-gray-400 p-2">No items available</li>
            )}
        </ul>
    </div>
);

const FilterBar = ({ 
    patientId,
    events = [],
    filters,
    onFiltersChange
}) => {
    const queryClient = useQueryClient();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [viewName, setViewName] = useState('');

    // Extract unique names from events for each category
    const symptomNames = [...new Set(
        events
            .filter(e => e.event_type === 'symptom')
            .flatMap(e => e.measurements?.map(m => m.name) || [e.symptom_name])
            .filter(Boolean)
    )];

    const treatmentNames = [...new Set(
        events
            .filter(e => e.event_type === 'treatment')
            .map(e => e.name)
            .filter(Boolean)
    )];

    const wellnessMetrics = ['Mood', 'Anxiety'];

    const lifestyleCategories = ['Diet', 'Exercise', 'Sleep', 'Stress', 'Travel', 'Other'];

    // Fetch saved views
    const { data: savedViewsData } = useQuery({
        queryKey: ['savedViews', patientId],
        queryFn: () => getSavedViews(patientId),
        enabled: !!patientId,
    });
    
    // Ensure savedViews is always an array
    const savedViews = Array.isArray(savedViewsData) ? savedViewsData : [];

    const saveViewMutation = useMutation({
        mutationFn: createSavedView,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['savedViews', patientId] });
            setShowSaveModal(false);
            setViewName('');
        }
    });

    const deleteViewMutation = useMutation({
        mutationFn: deleteSavedView,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['savedViews', patientId] });
        }
    });

    const handleToggleAll = (category, currentShowAll) => {
        onFiltersChange({
            ...filters,
            [`showAll${category}`]: !currentShowAll,
            [category.toLowerCase()]: !currentShowAll ? [] : filters[category.toLowerCase()]
        });
    };

    const handleToggleItem = (category, item) => {
        const key = category.toLowerCase();
        const currentItems = filters[key] || [];
        const showAllKey = `showAll${category}`;
        
        let newItems;
        if (currentItems.includes(item)) {
            newItems = currentItems.filter(i => i !== item);
        } else {
            newItems = [...currentItems, item];
        }
        
        onFiltersChange({
            ...filters,
            [key]: newItems,
            [showAllKey]: false
        });
    };

    const handleLoadView = (view) => {
        onFiltersChange(view.filters);
    };

    const handleSaveView = () => {
        if (!viewName.trim()) return;
        
        saveViewMutation.mutate({
            id: crypto.randomUUID(),
            patient_id: patientId,
            name: viewName,
            filters: filters,
            chart_type: 'line',
            created_at: new Date().toISOString()
        });
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
                {/* Filter Label */}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">
                    Filters:
                </span>

                {/* Symptoms Filter */}
                <FilterDropdown
                    title="Symptoms"
                    items={symptomNames}
                    category="Symptoms"
                    showAll={filters.showAllSymptoms}
                    selectedItems={filters.symptoms || []}
                    color="btn-primary btn-outline"
                    onToggleAll={handleToggleAll}
                    onToggleItem={handleToggleItem}
                />

                {/* Treatments Filter */}
                <FilterDropdown
                    title="Treatments"
                    items={treatmentNames}
                    category="Treatments"
                    showAll={filters.showAllTreatments}
                    selectedItems={filters.treatments || []}
                    color="btn-accent btn-outline"
                    onToggleAll={handleToggleAll}
                    onToggleItem={handleToggleItem}
                />

                {/* Wellness Filter */}
                <FilterDropdown
                    title="Wellness"
                    items={wellnessMetrics}
                    category="Wellness"
                    showAll={filters.showAllWellness}
                    selectedItems={filters.wellness || []}
                    color="btn-secondary btn-outline"
                    onToggleAll={handleToggleAll}
                    onToggleItem={handleToggleItem}
                />

                {/* Lifestyle Filter */}
                <FilterDropdown
                    title="Lifestyle"
                    items={lifestyleCategories}
                    category="Lifestyle"
                    showAll={filters.showAllLifestyle}
                    selectedItems={filters.lifestyle || []}
                    color="btn-info btn-outline"
                    onToggleAll={handleToggleAll}
                    onToggleItem={handleToggleItem}
                />

                <div className="flex-1"></div>

                {/* Saved Views Dropdown */}
                {savedViews.length > 0 && (
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-sm btn-ghost gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            Load View
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-lg w-48 border border-base-200">
                            {savedViews.map(view => (
                                <li key={view.id} className="flex flex-row items-center">
                                    <button 
                                        className="flex-1 text-left"
                                        onClick={() => handleLoadView(view)}
                                    >
                                        {view.name}
                                    </button>
                                    <button 
                                        className="btn btn-ghost btn-xs text-error"
                                        onClick={() => deleteViewMutation.mutate(view.id)}
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Save View Button */}
                <button 
                    className="btn btn-sm btn-ghost gap-1"
                    onClick={() => setShowSaveModal(true)}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save View
                </button>
            </div>

            {/* Selected Items Pills */}
            {(!filters.showAllSymptoms && filters.symptoms?.length > 0) ||
             (!filters.showAllTreatments && filters.treatments?.length > 0) ||
             (!filters.showAllWellness && filters.wellness?.length > 0) ||
             (!filters.showAllLifestyle && filters.lifestyle?.length > 0) ? (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                    {!filters.showAllSymptoms && filters.symptoms?.map(s => (
                        <span key={s} className="badge badge-primary badge-sm gap-1">
                            {s}
                            <button onClick={() => handleToggleItem('Symptoms', s)}>×</button>
                        </span>
                    ))}
                    {!filters.showAllTreatments && filters.treatments?.map(t => (
                        <span key={t} className="badge badge-accent badge-sm gap-1">
                            {t}
                            <button onClick={() => handleToggleItem('Treatments', t)}>×</button>
                        </span>
                    ))}
                    {!filters.showAllWellness && filters.wellness?.map(w => (
                        <span key={w} className="badge badge-secondary badge-sm gap-1">
                            {w}
                            <button onClick={() => handleToggleItem('Wellness', w)}>×</button>
                        </span>
                    ))}
                    {!filters.showAllLifestyle && filters.lifestyle?.map(l => (
                        <span key={l} className="badge badge-info badge-sm gap-1">
                            {l}
                            <button onClick={() => handleToggleItem('Lifestyle', l)}>×</button>
                        </span>
                    ))}
                </div>
            ) : null}

            {/* Save View Modal */}
            {showSaveModal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <h3 className="font-bold text-lg">Save Current View</h3>
                        <div className="py-4">
                            <input
                                type="text"
                                placeholder="View name..."
                                className="input input-bordered w-full"
                                value={viewName}
                                onChange={(e) => setViewName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSaveView}
                                disabled={!viewName.trim() || saveViewMutation.isPending}
                            >
                                {saveViewMutation.isPending ? (
                                    <span className="loading loading-spinner loading-xs"></span>
                                ) : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterBar;

