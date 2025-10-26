export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const API_ENDPOINTS = {
  health: '/health/supabase',
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout',
  },
  skills: {
    assess: '/skills/assess',
    extract: '/skills/extract',
    profile: '/skills/profile',
  },
  careers: {
    match: '/careers/match',
    recommendations: '/careers/recommendations',
    details: '/careers/details',
  },
  learning: {
    resources: '/learning/resources',
    path: '/learning/path',
    progress: '/learning/progress',
  },
  user: {
    profile: '/user/profile',
    dashboard: '/user/dashboard',
  },
};

