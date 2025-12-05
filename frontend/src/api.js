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

// Agent APIs

export const simulateAgentAnalysis = async (agentType, transcript) => {
    const response = await api.post('/agent/simulate', {
        agent_type: agentType,
        transcript: transcript
    });
    return response.data;
}
