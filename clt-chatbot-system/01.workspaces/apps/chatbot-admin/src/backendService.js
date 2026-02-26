import { interpolateMessage } from './simulatorUtils';
import useStore from './store';

const BASE_URL = import.meta.env.VITE_ADMIN_BACKEND_URL || 'http://localhost:8100';
const SCENARIOS_URL = `${BASE_URL}/scenarios`;
const SETTINGS_URL = `${BASE_URL}/settings`;
const TEMPLATES_URL = `${BASE_URL}/templates`;
const POSTS_URL = `${BASE_URL}/posts`;

const handleResponse = async (response) => {
  if (!response.ok) {
    let errorText = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorText = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail);
      } else if (errorData.message) {
        errorText = errorData.message;
      }
    } catch (err) {
      const text = await response.text().catch(() => null);
      if (text) errorText = text;
    }
    throw new Error(errorText);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const mapScenarioSummary = (scenario) => ({
  id: scenario.id,
  name: scenario.title,
  title: scenario.title,
  description: scenario.description || '',
  job: scenario.job || 'Process',
  updatedAt: scenario.updated_at ? new Date(scenario.updated_at) : null,
  lastUsedAt: scenario.last_used_at ? new Date(scenario.last_used_at) : null,
});

export const fetchScenarios = async () => {
  const response = await fetch(SCENARIOS_URL);
  const data = await handleResponse(response);
  return Array.isArray(data) ? data.map(mapScenarioSummary) : [];
};

export const createScenario = async ({ newScenarioName, job, description }) => {
  const response = await fetch(SCENARIOS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: newScenarioName,
      description: description || '',
      nodes: [],
      edges: [],
    }),
  });
  const data = await handleResponse(response);
  return {
    id: data.id,
    name: data.title,
    title: data.title,
    description: data.description || '',
    job: job || 'Process',
    updatedAt: data.updated_at ? new Date(data.updated_at) : null,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
  };
};

export const cloneScenario = async ({ scenarioToClone, newName }) => {
  const response = await fetch(`${SCENARIOS_URL}/${scenarioToClone.id}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  const data = await handleResponse(response);
  return {
    id: data.id,
    name: data.title,
    title: data.title,
    description: data.description || '',
    job: scenarioToClone.job || 'Process',
    updatedAt: data.updated_at ? new Date(data.updated_at) : null,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
  };
};

export const renameScenario = async ({ scenarioId, newName, job, description }) => {
  const response = await fetch(`${SCENARIOS_URL}/${scenarioId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName, job, description }),
  });
  const data = await handleResponse(response);
  return {
    id: data.id,
    name: data.title,
    title: data.title,
    description: data.description || '',
    job: job || data.job || 'Process',
    updatedAt: data.updated_at ? new Date(data.updated_at) : null,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
  };
};

export const deleteScenario = async ({ scenarioId }) => {
  const response = await fetch(`${SCENARIOS_URL}/${scenarioId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

export const fetchScenarioData = async (scenarioId) => {
  if (!scenarioId) {
    return { nodes: [], edges: [], startNodeId: null, description: '' };
  }
  const response = await fetch(`${SCENARIOS_URL}/${scenarioId}`);
  const data = await handleResponse(response);
  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
    startNodeId: data.start_node_id || null,
    description: data.description || '',
  };
};

export const saveScenarioData = async ({ scenario, data }) => {
  if (!scenario || !scenario.id) {
    throw new Error('No scenario selected to save.');
  }
  const payload = {
    title: scenario.name,
    description: scenario.description || '',
    nodes: data.nodes,
    edges: data.edges,
    start_node_id: data.startNodeId,
  };
  const response = await fetch(`${SCENARIOS_URL}/${scenario.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const responseData = await handleResponse(response);
  return {
    ...responseData,
    startNodeId: responseData.start_node_id || null,
  };
};

export const fetchApiTemplates = async () => {
  const response = await fetch(`${TEMPLATES_URL}/api`);
  return handleResponse(response);
};

export const saveApiTemplate = async (templateData) => {
  const response = await fetch(`${TEMPLATES_URL}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData),
  });
  return handleResponse(response);
};

export const deleteApiTemplate = async (templateId) => {
  const response = await fetch(`${TEMPLATES_URL}/api/${templateId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

export const fetchFormTemplates = async () => {
  const response = await fetch(`${TEMPLATES_URL}/form`);
  return handleResponse(response);
};

export const saveFormTemplate = async (templateData) => {
  const response = await fetch(`${TEMPLATES_URL}/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData),
  });
  return handleResponse(response);
};

export const deleteFormTemplate = async (templateId) => {
  const response = await fetch(`${TEMPLATES_URL}/form/${templateId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

export const fetchNodeVisibility = async () => {
  const response = await fetch(`${SETTINGS_URL}/node-visibility`);
  return handleResponse(response);
};

export const saveNodeVisibility = async (visibleNodeTypes) => {
  const response = await fetch(`${SETTINGS_URL}/node-visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibleNodeTypes }),
  });
  return handleResponse(response);
};

export const fetchNodeColors = async () => {
  const response = await fetch(`${SETTINGS_URL}/node-colors`);
  return handleResponse(response);
};

export const saveNodeColors = async (colors) => {
  const response = await fetch(`${SETTINGS_URL}/node-colors`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colors }),
  });
  return handleResponse(response);
};

export const fetchNodeTextColors = async () => {
  const response = await fetch(`${SETTINGS_URL}/node-text-colors`);
  return handleResponse(response);
};

export const saveNodeTextColors = async (colors) => {
  const response = await fetch(`${SETTINGS_URL}/node-text-colors`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colors }),
  });
  return handleResponse(response);
};

export const fetchPosts = async () => {
  const response = await fetch(POSTS_URL);
  return handleResponse(response);
};

export const createPost = async ({ text }) => {
  const response = await fetch(POSTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return handleResponse(response);
};

export const updatePost = async ({ postId, text }) => {
  const response = await fetch(`${POSTS_URL}/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return handleResponse(response);
};

export const deletePost = async ({ postId }) => {
  const response = await fetch(`${POSTS_URL}/${postId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

export const testApiCall = async (apiCall) => {
  const { slots } = useStore.getState();
  const interpolatedUrl = interpolateMessage(apiCall.url, slots);
  const interpolatedHeaders = JSON.parse(interpolateMessage(apiCall.headers || '{}', slots));
  const rawBody = apiCall.body || '{}';
  const finalBody = interpolateMessage(rawBody, slots);

  const options = {
    method: apiCall.method,
    headers: { 'Content-Type': 'application/json', ...interpolatedHeaders },
    body: (apiCall.method !== 'GET' && apiCall.method !== 'HEAD') ? finalBody : undefined,
  };

  const response = await fetch(interpolatedUrl, options);
  let result;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
  } else {
    result = await response.text();
  }

  if (!response.ok) {
    const errorMessage = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    throw new Error(`HTTP ${response.status}: ${errorMessage}`);
  }

  return result;
};
