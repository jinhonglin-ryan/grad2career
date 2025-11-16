// SkillBridge Design System Theme
// Based on coal heritage colors with forward-looking clean energy accents

export const theme = {
  token: {
    colorPrimary: '#2563EB', // Electric Blue 600
    colorInfo: '#2563EB',
    colorSuccess: '#0EA5A5', // Teal 500
    colorWarning: '#F59E0B',
    colorError: '#DC2626',
    colorTextBase: '#0F172A', // Anthracite 900
    colorTextSecondary: '#475569', // Slate 600
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F7F6F3', // Sand 50
    borderRadius: 10,
    wireframe: false,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
  },
  components: {
    Button: { 
      borderRadius: 10, 
      controlHeight: 40, 
      paddingInline: 18,
      fontWeight: 500,
    },
    Card: { 
      borderRadiusLG: 16, 
      boxShadowSecondary: '0 8px 24px rgba(15, 23, 42, 0.06)',
      paddingLG: 24,
    },
    Tag: { 
      colorTextLightSolid: '#0F172A',
      borderRadius: 8,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
  }
};

// Color palette constants for direct use in CSS
export const colors = {
  anthracite900: '#0F172A',
  slate600: '#475569',
  teal500: '#0EA5A5',
  electricBlue600: '#2563EB',
  lime400: '#A3E635',
  sand50: '#F7F6F3',
  white: '#FFFFFF',
  // Additional colors for gradients and accents
  teal400: '#2DD4BF',
  blue500: '#3B82F6',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
};

// Typography scale
export const typography = {
  h1: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    fontSize: '2.5rem',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: colors.anthracite900,
  },
  h2: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    fontSize: '2rem',
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    color: colors.anthracite900,
  },
  h3: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.5rem',
    lineHeight: 1.4,
    color: colors.anthracite900,
  },
  body: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: 1.5,
    color: colors.anthracite900,
  },
  bodyLarge: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: '16px',
    lineHeight: 1.5,
    color: colors.anthracite900,
  },
  caption: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: '12px',
    lineHeight: 1.4,
    color: colors.slate600,
  },
};




