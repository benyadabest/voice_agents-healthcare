import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAnnotation } from '../../api';

const ANNOTATION_COLORS = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
];

const AnnotationModalInner = ({
    onClose,
    patientId,
    preselectedTimeRange = null
}) => {
    const queryClient = useQueryClient();
    
    // Form state
    const [title, setTitle] = useState('');
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(preselectedTimeRange?.start || today);
    const [endDate, setEndDate] = useState(preselectedTimeRange?.end || today);
    const [text, setText] = useState('');
    const [color, setColor] = useState(ANNOTATION_COLORS[0].value);

    const createMutation = useMutation({
        mutationFn: createAnnotation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['annotations', patientId] });
            onClose();
        },
        onError: (error) => {
            console.error('Failed to create annotation', error);
            const message = error.response?.data?.detail || error.message || 'Unknown error';
            alert(`Failed to create annotation: ${message}`);
        }
    });

    const handleSubmit = () => {
        if (!patientId) {
            alert('No patient selected. Please ensure a profile is loaded.');
            return;
        }

        if (!title.trim()) {
            alert('Please enter a title for the annotation');
            return;
        }

        if (!startDate || !endDate) {
            alert('Please select start and end dates');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            alert('End date must be after start date');
            return;
        }

        const annotation = {
            id: crypto.randomUUID(),
            patient_id: patientId,
            title: title.trim(),
            start_timestamp: new Date(startDate).toISOString(),
            end_timestamp: new Date(endDate).toISOString(),
            text: text.trim() || null,
            color: color,
            created_at: new Date().toISOString()
        };

        createMutation.mutate(annotation);
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h3 className="font-bold text-lg mb-2">Add Annotation</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Mark a time period on your timeline (e.g., vacation, hospital stay, stressful period)
                </p>

                {/* Title */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-medium">Title</span>
                    </label>
                    <input 
                        type="text"
                        className="input input-bordered"
                        placeholder="e.g., Family Vacation, Hospital Stay, Work Deadline"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Time Range Selection */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Start Date</span>
                        </label>
                        <input 
                            type="date" 
                            className="input input-bordered"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">End Date</span>
                        </label>
                        <input 
                            type="date" 
                            className="input input-bordered"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text">Notes (optional)</span>
                    </label>
                    <textarea 
                        className="textarea textarea-bordered h-20"
                        placeholder="Additional details about this period..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>

                {/* Color Selection */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text">Color</span>
                    </label>
                    <div className="flex gap-2">
                        {ANNOTATION_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                                    color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => setColor(c.value)}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <span className="loading loading-spinner loading-xs"></span>
                        ) : 'Add Annotation'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AnnotationModal = ({ 
    isOpen, 
    onClose, 
    patientId,
    preselectedTimeRange = null
}) => {
    if (!isOpen) return null;

    // Key ensures the inner form resets cleanly on each open / time-range change
    const key = `${patientId || 'no-patient'}:${preselectedTimeRange?.start || ''}:${preselectedTimeRange?.end || ''}`;

    return (
        <AnnotationModalInner
            key={key}
            onClose={onClose}
            patientId={patientId}
            preselectedTimeRange={preselectedTimeRange}
        />
    );
};

export default AnnotationModal;
