import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createEC2 = async (credentials) => {
  // credentials now includes { access_key, secret_key, region, os_type }
  const response = await api.post('/create-ec2', credentials);
  return response.data;
};

export const deployApp = async (data) => {
  // Deprecated
  return { error: "Use cloneRepos and startDeploy" };
};

export const cloneRepos = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/clone-repos`, data);
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
};

export const startDeploy = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/start-deploy`, data);
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
};

export const deleteEC2 = async (data) => {
  const response = await api.post('/delete-ec2', data);
  return response.data;
};

export const scheduleTermination = async (scheduleConfig) => {
  const response = await api.post('/schedule-termination', scheduleConfig);
  return response.data;
};

export const gitPull = async (pullConfig) => {
  const response = await api.post('/git-pull', pullConfig);
  return response.data;
};

export const executeCommand = async (commandConfig) => {
  const response = await api.post('/execute-command', commandConfig);
  return response.data;
};

export const readFile = async (fileConfig) => {
  const response = await api.post('/read-file', fileConfig);
  return response.data;
};

export const writeFile = async (fileConfig) => {
  const response = await api.post('/write-file', fileConfig);
  return response.data;
};

