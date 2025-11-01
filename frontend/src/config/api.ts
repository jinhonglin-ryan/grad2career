export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const API_ENDPOINTS = {
  health: '/health/supabase',
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout',
    googleLogin: '/auth/google/login',
    googleCallback: '/auth/google/callback',
  },
  skills: {
    assess: '/skills/assess/conversation',
    start: '/skills/assess/start',
    extract: '/skills/extract',
    profile: '/skills/profile',
    session: '/skills/assess/session',
    getProfile: '/skills/profile', // GET /skills/profile/{user_id}
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

