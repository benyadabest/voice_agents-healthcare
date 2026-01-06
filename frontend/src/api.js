import axios from 'axios';

const API_URL = ''; // Relative path, handled by Vite proxy

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getProfile = async () => {
  try {
    const response = await api.get('/profile');
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};

export const saveProfile = async (profileData) => {
  const response = await api.post('/profile', profileData);
  return response.data;
};

// Profile Management
export const getProfiles = async () => {
    const response = await api.get('/profiles');
    return response.data;
};

export const switchProfile = async (profileId) => {
    const response = await api.post(`/profile/switch/${profileId}`);
    return response.data;
};

export const deleteProfile = async (profileId) => {
    const response = await api.delete(`/profile/${profileId}`);
    return response.data;
};

export const createNewProfile = async (name) => {
    const response = await api.post('/profile/new', { name });
    return response.data;
};

export const generateProfileFromDescription = async (description, name, monthsOfHistory = 6) => {
    const payload = { description };
    if (name) payload.name = name;
    if (monthsOfHistory) payload.months_of_history = monthsOfHistory;
    const response = await api.post('/profile/generate', payload);
    return response.data;
};

// Timeline APIs

export const createEvent = async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
};

export const getPatientEvents = async (patientId) => {
    const response = await api.get(`/events/${patientId}`);
    return response.data;
};

export const deleteEvent = async (eventId) => {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
};

// Bulk Event Creation (LLM-powered)

export const createBulkEvents = async (patientId, prompt) => {
    const response = await api.post('/events/bulk-create', {
        patient_id: patientId,
        prompt: prompt
    });
    return response.data;
};

// Annotation APIs

export const getAnnotations = async (patientId) => {
    if (!patientId) return [];
    try {
        const response = await api.get(`/annotations/${patientId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching annotations:', error);
        return [];
    }
};

export const createAnnotation = async (annotationData) => {
    const response = await api.post('/annotations', annotationData);
    return response.data;
};

export const deleteAnnotation = async (annotationId) => {
    const response = await api.delete(`/annotations/${annotationId}`);
    return response.data;
};

// Saved View APIs

export const getSavedViews = async (patientId) => {
    if (!patientId) return [];
    try {
        const response = await api.get(`/views/${patientId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching saved views:', error);
        return [];
    }
};

export const createSavedView = async (viewData) => {
    const response = await api.post('/views', viewData);
    return response.data;
};

export const deleteSavedView = async (viewId) => {
    const response = await api.delete(`/views/${viewId}`);
    return response.data;
};

// Voice Check-In APIs (Custom LLM-powered)

export const precomputeQuestions = async (patientId, windowHours = 84) => {
    const response = await api.post('/voice/precompute-questions', {
        patient_id: patientId,
        window_hours: windowHours
    });
    return response.data;
};

export const startBrainConversation = async (patientId, windowHours = 84) => {
    const response = await api.post('/voice/brain/start', {
        patient_id: patientId,
        window_hours: windowHours
    });
    return response.data;
};

export const sendBrainMessage = async (text, state) => {
    const response = await api.post('/voice/brain', {
        text,
        state
    });
    return response.data;
};

export const addCustomQuestion = async (patientId, question) => {
    const response = await api.post('/voice/questions/add', {
        patient_id: patientId,
        question
    });
    return response.data;
};

export const getCustomQuestions = async (patientId) => {
    const response = await api.get(`/voice/questions/${patientId}`);
    return response.data;
};

export const deleteCustomQuestion = async (patientId, index) => {
    const response = await api.delete(`/voice/questions/${patientId}/${index}`);
    return response.data;
};

// Health Chat APIs (ReAct Agent)

export const startChatConversation = async (patientId) => {
    const response = await api.post('/chat/start', {
        patient_id: patientId
    });
    return response.data;
};

export const sendChatMessage = async (text, state) => {
    const response = await api.post('/chat/message', {
        text,
        state
    });
    return response.data;
};
