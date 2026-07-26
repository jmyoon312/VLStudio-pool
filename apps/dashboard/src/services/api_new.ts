/**
 * New API hooks for Phase 7-10 services
 * Add to existing frontend at /app/src/lib/api.ts
 */

// ==================== Queue Management ====================

export const queueApi = {
  getAll: async (params?: { channel_id?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetch(`/api/queue${query ? '?' + query : ''}`).then(r => r.json());
  },
  
  getStatus: async () => {
    return fetch('/api/queue/status').then(r => r.json());
  },
  
  enqueue: async (data: any) => {
    return fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  
  updateStatus: async (itemId: string, status: string, url?: string) => {
    return fetch(`/api/queue/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, youtube_url: url })
    }).then(r => r.json());
  },
  
  reschedule: async (itemId: string, scheduledAt: string) => {
    return fetch(`/api/queue/${itemId}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: scheduledAt })
    }).then(r => r.json());
  },
  
  cancel: async (itemId: string, reason?: string) => {
    return fetch(`/api/queue/${itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }).then(r => r.json());
  },
  
  setSchedule: async (channelId: string, dailyLimit: number, uploadTimes?: string[]) => {
    return fetch('/api/queue/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, daily_limit: dailyLimit, upload_times: uploadTimes })
    }).then(r => r.json());
  }
};

// ==================== Processing Verification ====================

export const verificationApi = {
  register: async (data: any) => {
    return fetch('/api/verification/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  
  updateStage: async (itemId: string, stage: string, actor?: string) => {
    return fetch(`/api/verification/${itemId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, actor })
    }).then(r => r.json());
  },
  
  getStatus: async (itemId: string) => {
    return fetch(`/api/verification/${itemId}/status`).then(r => r.json());
  },
  
  verifyWorkflow: async (itemId: string) => {
    return fetch(`/api/verification/${itemId}/verify`).then(r => r.json());
  },
  
  getMissing: async (hours: number = 24) => {
    return fetch(`/api/verification/missing?hours=${hours}`).then(r => r.json());
  },
  
  getAlerts: async (level?: string, channelId?: string) => {
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (channelId) params.set('channel_id', channelId);
    return fetch(`/api/verification/alerts?${params}`).then(r => r.json());
  },
  
  getTeamWorkload: async (team?: string) => {
    const params = team ? `?team=${team}` : '';
    return fetch(`/api/verification/team-workload${params}`).then(r => r.json());
  },
  
  getSlaReport: async (hours: number = 24) => {
    return fetch(`/api/verification/sla-report?hours=${hours}`).then(r => r.json());
  },
  
  getSummary: async (channelId?: string) => {
    const params = channelId ? `?channel_id=${channelId}` : '';
    return fetch(`/api/verification/summary${params}`).then(r => r.json());
  },
  
  resolveAlert: async (alertId: string) => {
    return fetch(`/api/verification/alerts/${alertId}/resolve`, {
      method: 'POST'
    }).then(r => r.json());
  }
};

// ==================== Dashboard & Reports ====================

export const dashboardApi = {
  getSystemStatus: async () => {
    return fetch('/api/dashboard/status').then(r => r.json());
  },
  
  getQuickStats: async () => {
    return fetch('/api/dashboard/stats').then(r => r.json());
  },
  
  registerService: async (name: string, status: string, message?: string) => {
    return fetch('/api/dashboard/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, status, message })
    }).then(r => r.json());
  },
  
  updateServiceStatus: async (name: string, status: string, message?: string, metrics?: object) => {
    return fetch(`/api/dashboard/services/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, message, metrics })
    }).then(r => r.json());
  }
};

export const reportApi = {
  getDaily: async (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return fetch(`/api/reports/daily${params}`).then(r => r.json());
  },
  
  getWeekly: async (weekStart?: string) => {
    const params = weekStart ? `?week_start=${weekStart}` : '';
    return fetch(`/api/reports/weekly${params}`).then(r => r.json());
  },
  
  getMonthly: async (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return fetch(`/api/reports/monthly?${params}`).then(r => r.json());
  },
  
  getList: async (limit: number = 10) => {
    return fetch(`/api/reports?limit=${limit}`).then(r => r.json());
  },
  
  export: async (reportId: string, format: string = 'json') => {
    return fetch(`/api/reports/${reportId}/export?format=${format}`).then(r => r.json());
  }
};

// ==================== Metrics ====================

export const metricsApi = {
  record: async (name: string, value: number, tags?: object) => {
    return fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, tags })
    }).then(r => r.json());
  },
  
  get: async (name: string, hours: number = 24, tags?: object) => {
    const params = new URLSearchParams({ hours: String(hours) });
    return fetch(`/api/metrics/${name}?${params}`).then(r => r.json());
  },
  
  getKpi: async (name: string) => {
    return fetch(`/api/metrics/kpi/${name}`).then(r => r.json());
  },
  
  getAllKpis: async () => {
    return fetch('/api/metrics/kpis').then(r => r.json());
  },
  
  getTrends: async (name: string, days: number = 7, interval: string = '1d') => {
    return fetch(`/api/metrics/trends/${name}?days=${days}&interval=${interval}`).then(r => r.json());
  },
  
  getDashboard: async () => {
    return fetch('/api/metrics/dashboard').then(r => r.json());
  }
};

// ==================== Health & Deployment ====================

export const healthApi = {
  check: async () => {
    return fetch('/api/health').then(r => r.json());
  },
  
  checkService: async (serviceName: string) => {
    return fetch(`/api/health/${serviceName}`).then(r => r.json());
  },
  
  getResources: async (hours: number = 1) => {
    return fetch(`/api/health/resources?hours=${hours}`).then(r => r.json());
  },
  
  getAlerts: async (severity?: string) => {
    const params = severity ? `?severity=${severity}` : '';
    return fetch(`/api/health/alerts${params}`).then(r => r.json());
  },
  
  getSummary: async () => {
    return fetch('/api/health/summary').then(r => r.json());
  }
};

export const deployApi = {
  getConfig: async (environment: string) => {
    return fetch(`/api/deploy/config/${environment}`).then(r => r.json());
  },
  
  getManifests: async (environment: string) => {
    return fetch(`/api/deploy/manifests/${environment}`).then(r => r.json());
  },
  
  validate: async (environment: string) => {
    return fetch('/api/deploy/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment })
    }).then(r => r.json());
  },
  
  listSecrets: async () => {
    return fetch('/api/deploy/secrets').then(r => r.json());
  },
  
  setSecret: async (key: string, value: string) => {
    return fetch(`/api/deploy/secrets/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }).then(r => r.json());
  }
};

export const cicdApi = {
  listPipelines: async () => {
    return fetch('/api/cicd/pipelines').then(r => r.json());
  },
  
  run: async (pipelineName: string, environment?: string, commitSha?: string) => {
    return fetch('/api/cicd/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_name: pipelineName, environment, commit_sha: commitSha })
    }).then(r => r.json());
  },
  
  getStatus: async (runId: string) => {
    return fetch(`/api/cicd/status/${runId}`).then(r => r.json());
  },
  
  getHistory: async (pipelineName?: string, limit: number = 10) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (pipelineName) params.set('pipeline_name', pipelineName);
    return fetch(`/api/cicd/history?${params}`).then(r => r.json());
  },
  
  cancel: async (runId: string) => {
    return fetch(`/api/cicd/cancel/${runId}`, { method: 'POST' }).then(r => r.json());
  }
};

// ==================== ML, A/B, Search, Recommendations ====================

export const mlApi = {
  train: async (data: any) => {
    return fetch('/api/ml/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  
  predict: async (modelId: string, features: object) => {
    return fetch(`/api/ml/predict?model_id=${modelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features })
    }).then(r => r.json());
  },
  
  listModels: async (name?: string) => {
    const params = name ? `?name=${name}` : '';
    return fetch(`/api/ml/models${params}`).then(r => r.json());
  },
  
  getModel: async (modelId: string) => {
    return fetch(`/api/ml/models/${modelId}`).then(r => r.json());
  },
  
  getLatest: async (name: string) => {
    return fetch(`/api/ml/latest/${name}`).then(r => r.json());
  }
};

export const abApi = {
  createExperiment: async (name: string, variants: object) => {
    return fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, variants })
    }).then(r => r.json());
  },
  
  startExperiment: async (expId: string) => {
    return fetch(`/api/experiments/${expId}/start`, { method: 'POST' }).then(r => r.json());
  },
  
  getVariant: async (expId: string, userId: string) => {
    return fetch(`/api/experiments/${expId}/variant?user_id=${userId}`).then(r => r.json());
  },
  
  recordConversion: async (expId: string, userId: string, metric: string, value: number = 1) => {
    return fetch(`/api/experiments/${expId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, metric, value })
    }).then(r => r.json());
  },
  
  getResults: async (expId: string) => {
    return fetch(`/api/experiments/${expId}/results`).then(r => r.json());
  },
  
  list: async () => {
    return fetch('/api/experiments').then(r => r.json());
  }
};

export const searchApi = {
  index: async (docId: string, document: object) => {
    return fetch('/api/search/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, document })
    }).then(r => r.json());
  },
  
  search: async (query: string, filters?: object, limit: number = 10) => {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (filters) params.set('filters', JSON.stringify(filters));
    return fetch(`/api/search?${params}`).then(r => r.json());
  },
  
  autocomplete: async (prefix: string, limit: number = 5) => {
    return fetch(`/api/search/autocomplete?prefix=${prefix}&limit=${limit}`).then(r => r.json());
  },
  
  getAnalytics: async () => {
    return fetch('/api/search/analytics').then(r => r.json());
  }
};

export const recommendationApi = {
  get: async (userId: number, niche?: string, currentVideo?: string, limit: number = 10) => {
    const params = new URLSearchParams({ user_id: String(userId), limit: String(limit) });
    if (niche) params.set('niche', niche);
    if (currentVideo) params.set('current_video', currentVideo);
    return fetch(`/api/recommendations?${params}`).then(r => r.json());
  },
  
  updatePreferences: async (userId: number, watchedVideos: string[], likedVideos?: string[]) => {
    return fetch('/api/recommendations/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, watched_videos: watchedVideos, liked_videos: likedVideos })
    }).then(r => r.json());
  },
  
  getSimilar: async (videoId: string, limit: number = 5) => {
    return fetch(`/api/recommendations/similar/${videoId}?limit=${limit}`).then(r => r.json());
  },
  
  getTrending: async (timeframe: string = '24h', limit: number = 10) => {
    return fetch(`/api/recommendations/trending?timeframe=${timeframe}&limit=${limit}`).then(r => r.json());
  },
  
  getPopular: async (niche: string, limit: number = 10) => {
    return fetch(`/api/recommendations/popular/${niche}?limit=${limit}`).then(r => r.json());
  },
  
  getUserStats: async (userId: number) => {
    return fetch(`/api/recommendations/stats/${userId}`).then(r => r.json());
  }
};