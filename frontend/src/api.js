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

// Agent APIs

export const simulateAgentAnalysis = async (agentType, transcript) => {
    const response = await api.post('/agent/simulate', {
        agent_type: agentType,
        transcript: transcript
    });
    return response.data;
}

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
