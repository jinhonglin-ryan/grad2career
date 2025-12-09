import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BookOpen, Clock, CheckCircle, MessageSquare, ArrowLeft, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input, Button, Spin, Empty, Modal, Steps, Progress, Checkbox, Tooltip, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from '../components/Logo';
import styles from './LearningPath.module.css';

type VideoItem = {
  videoId: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: string;
};

type ScheduledVideo = {
  date: string; // ISO date string (yyyy-mm-dd)
  video: VideoItem;
  completed?: boolean;
  completedAt?: string;
  notes?: string;
};

type AgentStatus = {
  status: 'running' | 'completed' | 'error';
  steps?: Array<{ text?: string; label?: string }>;
  result?: { answer?: string };
  error?: string;
};

type LearningPathData = {
  id: string;
  user_id: string;
  career_id?: string;
  path_data: {
    career_title: string;
    scheduled_videos: ScheduledVideo[];
  };
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
};

const MOCK_SOLAR_SKILLS: string[] = [
  'PV System Fundamentals',
  'Electrical Safety & PPE',
  'Roof Work & Fall Protection (OSHA)',
  'Racking & Mounting Systems',
  'Module, Inverter & String Wiring',
  'NEC Basics for PV (Article 690)',
  'Site Assessment & Array Layout',
  'Commissioning & Troubleshooting',
];

const LearningPath = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const career = (location as any).state?.career;

  // Dashboard states
  const [scheduled, setScheduled] = useState<ScheduledVideo[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [learningPathId, setLearningPathId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedCareerTitle, setSavedCareerTitle] = useState<string>('');

  // Floating chat states
  const [modalOpen, setModalOpen] = useState(true);
  const [chatStage, setChatStage] = useState<0 | 1 | 2>(0);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<Array<{ label?: string; text?: string; status?: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  
  // Day selector state
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Calendar month navigation
  const [currentMonth, setCurrentMonth] = useState(dayjs());

  // Start a brand new plan (archive existing, reset UI, and reopen assistant)
  const startNewPlan = async () => {
    try {
      // If there's an existing learning path, mark it as completed so the new one becomes current
      if (learningPathId) {
        try {
          await api.patch(`/learning/learning-paths/${learningPathId}/status`, null, {
            params: { status: 'completed' },
          });
        } catch (err) {
          console.error('Failed to update existing learning path status:', err);
          // Non-fatal: we can still create a new path; the latest active will be used
        }
      }

      // Reset local state for a clean slate
      setScheduled([]);
      setLearningPathId(null);
      setSelectedDays([]);
      setMessages([]);
      setAgentSteps([]);
      setPollError(null);
      setChatStage(0);
      lastJobIdRef.current = null;

      // Re-open onboarding modal to collect new availability and trigger agent
      setModalOpen(true);
    } catch (error) {
      console.error('Error starting new plan:', error);
      message.error('Failed to start a new learning plan. Please try again.');
    }
  };
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const lastJobIdRef = useRef<string | null>(null);

  // Load existing learning path on mount
  useEffect(() => {
    loadExistingPath();
  }, []);

  // Reload when returning to this page (in case completion status changed)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && learningPathId) {
        // Page became visible, reload to sync any changes
        loadExistingPath();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [learningPathId]);

  // Seed chat message after loading with typing effect
  useEffect(() => {
    if (!loading && scheduled.length === 0) {
      // Only show welcome message if we have career context
      // Don't redirect here - loadExistingPath will handle that
      if (career || savedCareerTitle) {
        const careerTitle = career?.title || savedCareerTitle || 'Solar Panel Installer Technician';
        const welcomeMessage = 
          `Great! We'll build a starter plan for becoming a ${careerTitle}. ` +
          `We'll focus on basics like ${MOCK_SOLAR_SKILLS.slice(0, 3).join(', ')}. ` +
          `Select the days you're available to study below:`;
        
        setIsTyping(true);
        setTimeout(() => {
          setMessages([{ role: 'bot', text: welcomeMessage }]);
          setIsTyping(false);
          setChatStage(0);
        }, 800);
      }
    }
  }, [loading, scheduled.length, career, savedCareerTitle]);

  // Toggle day selection
  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Handle day selection submit
  const handleDaysSubmit = async () => {
    if (selectedDays.length === 0) {
      message.warning('Please select at least one day');
      return;
    }

    // Sort days by their index in the week
    const sortedDays = [...selectedDays].sort((a, b) => 
      DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)
    );

    setMessages(m => [...m, { role: 'user', text: `Available days: ${sortedDays.join(', ')}` }]);
    
    setIsTyping(true);
    setTimeout(async () => {
      setMessages(m => [
        ...m,
        { role: 'bot', text: '🚀 Generating a tailored learning plan with videos scheduled for your available days...' },
      ]);
      setIsTyping(false);
      setChatStage(1);
      
      // Fire real job with selected days
      try {
        setCreatingPlan(true);
        setStepsExpanded(true);
        const careerTitle = career?.title || savedCareerTitle || 'Solar Panel Installer Technician';
        const resp = await api.post('/agent/ask', {
          query: `Create a beginner ${careerTitle} learning plan with YouTube videos. User is available on these days: ${sortedDays.join(', ')}. Assign one video per available day.`,
          user_id: 'web',
          session_id: 'default',
        });
        const id = resp.data?.job_id;
        if (!id) throw new Error('No job_id returned');
        lastJobIdRef.current = id;
        setPolling(true);
        pollStatus(id);
      } catch (e: any) {
        setPollError(e?.message || 'Failed to start plan generation');
        setCreatingPlan(false);
        setPolling(false);
      }
    }, 500);
  };

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, agentSteps, isTyping]);

  useEffect(() => {
    if (scheduled.length > 0) {
      setModalOpen(false);
    }
  }, [scheduled.length]);

  // Load existing learning path from backend
  const loadExistingPath = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading existing learning path...');
      const response = await api.get('/learning/learning-paths/current');
      console.log('✅ Learning path response:', response.data);
      
      if (response.data?.success && response.data?.data) {
        const pathData: LearningPathData = response.data.data;
        console.log('📚 Found learning path:', pathData.id);
        setLearningPathId(pathData.id);
        
        // Merge backend data with localStorage completion status
        const videos = pathData.path_data.scheduled_videos || [];
        console.log(`📹 Found ${videos.length} videos in learning path`);
        
        const mergedVideos = videos.map((sv: ScheduledVideo) => {
          // Check localStorage for completion status
          const localCompleted = localStorage.getItem(`video_completed_${sv.video.videoId}`);
          if (localCompleted === 'true' && !sv.completed) {
            // LocalStorage says completed but backend doesn't - sync to backend
            syncCompletionToBackend(pathData.id, sv.video.videoId, sv.date, true);
            return { ...sv, completed: true, completedAt: new Date().toISOString() };
          }
          return sv;
        });
        
        setScheduled(mergedVideos);
        setSavedCareerTitle(pathData.path_data.career_title || '');
        console.log('✨ Learning path loaded successfully');
      } else {
        console.log('ℹ️ No existing learning path found');
        // No existing path - check if we have career context
        if (!career) {
          console.log('⚠️ No career context, redirecting to careers page');
          message.info('Please select a career path to get started');
          setTimeout(() => navigate('/careers'), 1500);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to load learning path:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Only redirect if we have no career context to fall back on
      if (!career && !savedCareerTitle) {
        console.log('⚠️ No fallback career context, redirecting to careers page');
        message.info('Please select a career path to get started');
        setTimeout(() => navigate('/careers'), 1500);
      } else {
        console.log('ℹ️ Will use career context to create new plan');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync localStorage completion status to backend
  const syncCompletionToBackend = async (pathId: string, videoId: string, date: string, completed: boolean) => {
    try {
      await api.patch(`/learning/learning-paths/${pathId}/progress`, {
        videoId,
        date,
        completed,
      });
      console.log(`Synced completion status for ${videoId}: ${completed}`);
    } catch (error) {
      console.error('Failed to sync completion status:', error);
    }
  };

  // Save learning path to backend
  const saveLearningPath = async (videos: ScheduledVideo[]) => {
    try {
      setSaving(true);
      console.log('💾 Saving learning path...');
      
      // Prepare request body
      const requestBody: any = {
        career_title: career?.title || savedCareerTitle || 'Solar Panel Installer Technician',
        scheduled_videos: videos,
      };
      
      // Only include career_id if it's a valid UUID (36 characters with hyphens)
      if (career?.id && typeof career.id === 'string' && career.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        requestBody.career_id = career.id;
        console.log('✅ Including career_id:', career.id);
      } else {
        console.log('ℹ️ No valid career_id to include');
      }
      
      console.log('📦 Request body:', {
        career_title: requestBody.career_title,
        career_id: requestBody.career_id || 'none',
        video_count: videos.length
      });
      
      const response = await api.post('/learning/learning-paths', requestBody);
      console.log('✅ Save response:', response.data);
      
      if (response.data?.success && response.data?.data) {
        const newPathId = response.data.data.id;
        setLearningPathId(newPathId);
        console.log('🎉 Learning path saved with ID:', newPathId);
        message.success('Learning plan saved successfully!');
      } else {
        console.warn('⚠️ Save succeeded but response format unexpected:', response.data);
        message.warning('Learning plan may not have saved correctly');
      }
    } catch (error: any) {
      console.error('❌ Failed to save learning path:', error);
      console.error('Error details:', error.response?.data || error.message);
      message.error(`Failed to save learning plan: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle video completion status
  const toggleVideoCompletion = async (video: VideoItem, date: string) => {
    if (!learningPathId) return;

    const videoIndex = scheduled.findIndex(
      (sv) => sv.video.videoId === video.videoId && sv.date === date
    );
    if (videoIndex === -1) return;

    const currentVideo = scheduled[videoIndex];
    const newCompleted = !currentVideo.completed;

    // Optimistically update UI
    const updatedScheduled = [...scheduled];
    updatedScheduled[videoIndex] = {
      ...currentVideo,
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : undefined,
    };
    setScheduled(updatedScheduled);

    try {
      await api.patch(`/learning/learning-paths/${learningPathId}/progress`, {
        videoId: video.videoId,
        date: date,
        completed: newCompleted,
      });
      message.success(newCompleted ? 'Video marked as completed!' : 'Video marked as incomplete');
    } catch (error: any) {
      console.error('Failed to update progress:', error);
      // Revert on error
      setScheduled(scheduled);
      message.error('Failed to update progress');
    }
  };

  // Helpers
  const dateKey = (d: Dayjs | string) => dayjs(d).format('YYYY-MM-DD');

  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduledVideo[]> = {};
    for (const s of scheduled) {
      const key = dateKey(s.date);
      map[key] = map[key] || [];
      map[key].push(s);
    }
    return map;
  }, [scheduled]);

  // Calculate progress
  const progress = useMemo(() => {
    if (scheduled.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = scheduled.filter((sv) => sv.completed).length;
    const total = scheduled.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [scheduled]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setPollError(null);

    // If generating or generated, keep chat as general feedback
    if (chatStage >= 1) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', text: 'Working on your plan. I will update it shortly.' }]);
        setIsTyping(false);
      }, 300);
    }
  };

  const handleRetry = async () => {
    if (!lastJobIdRef.current) return;
    setPollError(null);
    setAgentSteps([]);
    setPolling(true);
    setCreatingPlan(true);
    pollStatus(lastJobIdRef.current);
  };

  const pollStatus = async (id: string) => {
    let done = false;
    let lastResult: AgentStatus | null = null;
    let seen = 0;
    try {
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const statusResp = await api.get<AgentStatus>(`/agent/status/${id}`);
        const data = statusResp.data;
        lastResult = data;

        // stream new steps into chat with status
        const steps = data.steps || [];
        if (steps.length > seen) {
          const newSteps = steps.slice(seen).map((s, idx) => ({
            label: s.label || 'Update',
            text: s.text || '',
            status: seen + idx < steps.length - 1 ? 'finish' : 'process',
          }));
          if (newSteps.length > 0) {
            setAgentSteps((prev) => {
              const updated = [...prev];
              // Mark previous steps as finished
              for (let i = 0; i < updated.length; i++) {
                updated[i].status = 'finish';
              }
              return [...updated, ...newSteps];
            });
          }
          seen = steps.length;
        }

        if (data.status === 'completed' || data.status === 'error') {
          // Mark all steps as finished
          setAgentSteps((prev) => prev.map((s) => ({ ...s, status: 'finish' })));
          done = true;
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e: any) {
      setPollError(e?.message || 'Polling failed');
      setAgentSteps((prev) => {
        if (prev.length > 0) {
          const updated = [...prev];
          updated[updated.length - 1].status = 'error';
          return updated;
        }
        return prev;
      });
    } finally {
      setPolling(false);
      setCreatingPlan(false);
    }

    if (lastResult) handleAgentCompletion(lastResult);
  };

  const handleAgentCompletion = async (res: AgentStatus) => {
    if (res.status === 'error') {
      setMessages((m) => [...m, { role: 'bot', text: `Error: ${res.error || 'Unknown error'}` }]);
      return;
    }

    // 1) Get all videos from the agent (full plan)
    let videos = extractVideos(res);

    // Fallback: if we couldn't parse videos directly, try to pull them from weekly_plan
    if ((!videos || videos.length === 0)) {
      const weeklyPlanFallback = extractWeeklyPlan(res);
      if (weeklyPlanFallback?.scheduled_videos?.length) {
        videos = weeklyPlanFallback.scheduled_videos.map((sv: any) => ({
          videoId: sv.videoId,
          title: sv.title,
          url: sv.url,
        }));
      }
    }

    if (!videos || videos.length === 0) {
      setMessages((m) => [...m, { role: 'bot', text: 'No videos found. Please try again.' }]);
      return;
    }

    // 2) Determine which days of week to use (user-selected, sorted)
    const sortedSelectedDays =
      selectedDays.length > 0
        ? [...selectedDays].sort(
            (a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)
          )
        : [...DAYS_OF_WEEK]; // Fallback: all days

    const numDays = sortedSelectedDays.length || 1;

    // 3) Spread videos across *multiple weeks*, one per selected day
    const today = dayjs();
    const todayDayIndex = today.day() === 0 ? 6 : today.day() - 1; // Convert Sunday=0 to Monday=0

    const plan: ScheduledVideo[] = videos.map((v, idx) => {
      const dayName = sortedSelectedDays[idx % numDays];
      const weekOffset = Math.floor(idx / numDays); // 0 for first week, 1 for second, etc.

      const dayIndex = DAYS_OF_WEEK.indexOf(dayName);
      let daysUntil = dayIndex - todayDayIndex;
      if (daysUntil < 0) daysUntil += 7;

      // Push into future weeks as needed
      daysUntil += weekOffset * 7;

      return {
        date: today.add(daysUntil, 'day').format('YYYY-MM-DD'),
        video: v,
        completed: false,
      };
    });

    // Sort by date
    plan.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

    setScheduled(plan);
    setChatStage(2);
    setMessages((m) => [
      ...m,
      {
        role: 'bot',
        text: `Plan created! I scheduled ${plan.length} video${
          plan.length !== 1 ? 's' : ''
        } across multiple weeks on your selected days.`,
      },
    ]);

    // Save to backend
    await saveLearningPath(plan);
  };

  const extractWeeklyPlan = (data: AgentStatus): any | null => {
    const tryParse = (txt?: string | null): any | null => {
      if (!txt) return null;
      try {
        return JSON.parse(txt);
      } catch {
        const match = txt.match(/```json[\s\S]*?({[\s\S]*?})[\s\S]*?```/);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1]);
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    const fromAnswer = tryParse(data.result?.answer);
    if (fromAnswer?.weekly_plan) return fromAnswer.weekly_plan;
    if (fromAnswer?.scheduled_videos) return fromAnswer; // Direct weekly plan format

    if (data.steps && data.steps.length) {
      for (let i = data.steps.length - 1; i >= 0; i -= 1) {
        const parsed = tryParse(data.steps[i]?.text || '');
        if (parsed?.weekly_plan) return parsed.weekly_plan;
        if (parsed?.scheduled_videos) return parsed;
      }
    }

    return null;
  };

  const extractVideos = (data: AgentStatus): VideoItem[] => {
    // 1) Try parsing result.answer as JSON
    const tryParse = (txt?: string | null): any | null => {
      if (!txt) return null;
      try {
        return JSON.parse(txt);
      } catch {
        // Try to extract JSON block from code fences
        const match = txt.match(/```json[\s\S]*?({[\s\S]*?})[\s\S]*?```/);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1]);
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    const fromAnswer = tryParse(data.result?.answer);
    let videos: any[] | undefined = fromAnswer?.videos;

    if (!videos && data.steps && data.steps.length) {
      // scan steps in reverse for a json block
      for (let i = data.steps.length - 1; i >= 0; i -= 1) {
        const parsed = tryParse(data.steps[i]?.text || '');
        if (parsed?.videos) {
          videos = parsed.videos;
          break;
        }
      }
    }

    if (!videos) return [];
    return videos
      .map((v) => ({
        videoId: v.videoId || v.id || '',
        title: v.title || 'Video',
        url: v.url || (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : ''),
      }))
      .filter((v) => v.videoId && v.url);
  };

  // Get the month's calendar grid
  // Monthly calendar grid for the visible month
  const monthCalendar = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');

    // Day of week for first day (0 = Sunday, 6 = Saturday)
    const startDayOfWeek = startOfMonth.day();

    const calendar: Array<{ date: Dayjs; isCurrentMonth: boolean; video: ScheduledVideo | null }> = [];

    // Days from previous month to fill first week
    for (let i = startDayOfWeek - 1; i >= 0; i -= 1) {
      const date = startOfMonth.subtract(i + 1, 'day');
      calendar.push({
        date,
        isCurrentMonth: false,
        video: null,
      });
    }

    // Days of current month
    for (let day = 1; day <= endOfMonth.date(); day += 1) {
      const date = startOfMonth.date(day);
      const key = dateKey(date);
      const items = itemsByDate[key] || [];

      calendar.push({
        date,
        isCurrentMonth: true,
        video: items.length > 0 ? items[0] : null, // show first video per day
      });
    }

    // Fill out last week with next month days
    const remainder = calendar.length % 7;
    const remainingDays = remainder === 0 ? 0 : 7 - remainder;
    if (remainingDays > 0) {
      for (let i = 1; i <= remainingDays; i += 1) {
        const date = endOfMonth.add(i, 'day');
        calendar.push({
          date,
          isCurrentMonth: false,
          video: null,
        });
      }
    }

    return calendar;
  }, [currentMonth, itemsByDate]);

  // Truncate video title
  const truncateTitle = (title: string, maxLength: number = 35) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };
  
  // Navigate months
  const goToPrevMonth = () => setCurrentMonth((prev) => prev.subtract(1, 'month'));
  const goToNextMonth = () => setCurrentMonth((prev) => prev.add(1, 'month'));
  const goToToday = () => setCurrentMonth(dayjs());

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Logo variant="icon" onClick={() => navigate('/dashboard')} />
          <div className={styles.navRight}>
            <button onClick={() => navigate('/dashboard')} className={styles.dashboardNavButton}>
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <span className={styles.userName}>{user?.name || user?.email}</span>
            <button onClick={logout} className={styles.logoutButton}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Learning Dashboard</h1>
            {saving && (
              <div className={styles.savingIndicator}>
                <Spin size="small" /> Saving...
              </div>
            )}
          </div>
          <div className={styles.careerPathBadge}>
            <span className={styles.pathIcon}>🎯</span>
            <span className={styles.pathText}>
              Path to become a <strong>{career?.title || savedCareerTitle || 'Solar Panel Installer Technician'}</strong>
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Spin size="large" tip="Loading your learning path..." />
          </div>
        ) : (
          <>
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <BookOpen size={24} />
                <div>
                  <div className={styles.summaryNumber}>{scheduled.length || 0}</div>
                  <div className={styles.summaryLabel}>Planned Videos</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircle2 size={24} />
                <div>
                  <div className={styles.summaryNumber}>
                    {progress.completed}/{progress.total}
                  </div>
                  <div className={styles.summaryLabel}>Completed</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <Clock size={24} />
                <div>
                  <div className={styles.summaryNumber}>{progress.percentage}%</div>
                  <div className={styles.summaryLabel}>Progress</div>
                </div>
              </div>
            </div>

            {scheduled.length > 0 && (
              <div className={styles.progressSection}>
                <Progress 
                  percent={progress.percentage} 
                  status={progress.percentage === 100 ? 'success' : 'active'}
                  strokeColor={{
                    '0%': '#667eea',
                    '100%': '#764ba2',
                  }}
                />
              </div>
            )}
          </>
        )}

        <section className={styles.skillsSection}>
          <div className={styles.skillsHeaderRow}>
            <h2>Required Skills for {career?.title || savedCareerTitle || 'Solar Panel Installer Technician'}</h2>
            {scheduled.length > 0 && (
              <button
                type="button"
                className={styles.newPlanButton}
                onClick={startNewPlan}
              >
                <RefreshCw size={16} style={{ marginRight: 6 }} />
                Start New Plan
              </button>
            )}
          </div>
          <div className={styles.skillTags}>
            {MOCK_SOLAR_SKILLS.map((s) => (
              <span key={s} className={styles.skillTag}>{s}</span>
            ))}
          </div>
        </section>

        <section>
          {scheduled.length === 0 ? (
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <Empty description="No plan yet. Use the chat to generate one." />
            </div>
          ) : (
            <div className={styles.monthlySchedule}>
              <div className={styles.calendarHeader}>
                <div className={styles.calendarNav}>
                  <button onClick={goToPrevMonth} className={styles.navButton}>
                    <ChevronLeft size={20} />
                  </button>
                  <h2>{currentMonth.format('MMMM YYYY')}</h2>
                  <button onClick={goToNextMonth} className={styles.navButton}>
                    <ChevronRight size={20} />
                  </button>
                </div>
                <button onClick={goToToday} className={styles.todayButton}>
                  Today
                </button>
              </div>
              
              {/* Day headers */}
              <div className={styles.dayHeaders}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className={styles.dayHeaderCell}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Monthly calendar grid */}
              <div className={styles.calendarGrid}>
                {monthCalendar.map(({ date, isCurrentMonth, video }) => (
                  <div
                    key={date.format('YYYY-MM-DD')}
                    className={`
                      ${styles.calendarCell}
                      ${!isCurrentMonth ? styles.calendarCellOtherMonth : ''}
                      ${date.isSame(dayjs(), 'day') ? styles.calendarCellToday : ''}
                      ${video?.completed ? styles.calendarCellCompleted : ''}
                      ${video ? styles.calendarCellHasVideo : ''}
                    `}
                  >
                    <div className={styles.cellDate}>
                      <span className={styles.dateNumber}>{date.date()}</span>
                    </div>
                    {video && isCurrentMonth && (
                      <div className={styles.cellVideo}>
                        <Checkbox
                          checked={video.completed || false}
                          onChange={() => toggleVideoCompletion(video.video, video.date)}
                          className={styles.cellCheckbox}
                        />
                        <Tooltip title={video.video.title}>
                          <span
                            className={styles.cellVideoTitle}
                            onClick={() =>
                              navigate(`/learning/video/${video.video.videoId}`, {
                                state: {
                                  video: video.video,
                                  career,
                                  date: video.date,
                                  learningPathId: learningPathId,
                                },
                              })
                            }
                          >
                            {truncateTitle(video.video.title, 25)}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Onboarding Modal Chat - forced before plan exists */}
      <Modal
        open={modalOpen && scheduled.length === 0 && !loading}
        onCancel={() => {}}
        closable={false}
        maskClosable={false}
        className={styles.assistantModal}
        title={
          <div className={styles.chatTitle}>
            <div className={styles.chatTitleIcon}>
              <MessageSquare size={20} />
            </div>
            <div>
              <div className={styles.chatTitleText}>Learning Plan Assistant</div>
              <div className={styles.chatTitleSubtext}>Let's create your personalized learning journey</div>
            </div>
          </div>
        }
        footer={[
          pollError && (
            <Button 
              key="retry"
              icon={<RefreshCw size={16} />}
              onClick={handleRetry}
              style={{ marginRight: 'auto' }}
            >
              Retry
            </Button>
          ),
          <Button 
            key="primary" 
            type="primary" 
            size="large"
            onClick={() => setModalOpen(false)} 
            disabled={scheduled.length === 0}
            icon={scheduled.length > 0 ? <CheckCircle size={16} /> : undefined}
            className={scheduled.length > 0 ? styles.successButton : ''}
          >
            {scheduled.length > 0 ? '🎉 Start Learning Journey' : 'Creating your plan...'}
          </Button>,
        ]}
        width={700}
      >
        <div className={styles.chatBody}>
          <div className={styles.chatMessages} ref={chatMessagesRef}>
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={m.role === 'bot' ? styles.botMsg : styles.userMsg}
                style={{ 
                  animation: `fadeInUp 0.3s ease-out ${idx * 0.1}s both` 
                }}
              >
                {m.role === 'bot' && <div className={styles.botAvatar}>🤖</div>}
                <div className={styles.messageContent}>{m.text}</div>
              </div>
            ))}
            
            {isTyping && (
              <div className={styles.botMsg}>
                <div className={styles.botAvatar}>🤖</div>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            {(creatingPlan || polling) && !pollError && (
              <div className={styles.botMsg}>
                <div className={styles.botAvatar}>🤖</div>
                <div className={styles.messageContent}>
                  <Spin size="small" /> 
                  <span style={{ marginLeft: '0.75rem' }}>
                    Generating your personalized learning plan...
                  </span>
                </div>
              </div>
            )}
            
            {pollError && (
              <div className={`${styles.botMsg} ${styles.errorMsg}`}>
                <div className={styles.botAvatar}>⚠️</div>
                <div className={styles.messageContent}>
                  <strong>Oops! Something went wrong</strong>
                  <br />
                  {pollError}
                  <br />
                  <small>Click "Retry" below to try again.</small>
                </div>
              </div>
            )}
          </div>
          
          {agentSteps.length > 0 && (
            <div className={styles.agentStepsContainer}>
              <div 
                className={styles.agentStepsHeader}
                onClick={() => setStepsExpanded(!stepsExpanded)}
                style={{ cursor: 'pointer' }}
              >
                <span>🤖 AI Progress ({agentSteps.length} steps)</span>
                {stepsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {stepsExpanded && (
                <div className={styles.stepsContent}>
                  <Steps
                    direction="vertical"
                    size="small"
                    current={agentSteps.length - 1}
                    items={agentSteps.map((s) => ({
                      title: s.label,
                      description: s.text && s.text.length > 0 
                        ? (s.text.length > 120 ? s.text.substring(0, 120) + '...' : s.text)
                        : undefined,
                      status: s.status as any,
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Day selector for stage 0 */}
        {chatStage === 0 && !creatingPlan && !polling && (
          <div className={styles.daySelector}>
            <div className={styles.daySelectorLabel}>Select your available days:</div>
            <div className={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  className={`${styles.dayButton} ${selectedDays.includes(day) ? styles.dayButtonSelected : ''}`}
                  onClick={() => toggleDay(day)}
                  disabled={isTyping}
                >
                  <span className={styles.dayShort}>{day.slice(0, 3)}</span>
                  <span className={styles.dayFull}>{day}</span>
                </button>
              ))}
            </div>
            <Button
              type="primary"
              size="large"
              onClick={handleDaysSubmit}
              disabled={selectedDays.length === 0 || isTyping}
              className={styles.submitDaysButton}
            >
              Continue with {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected
            </Button>
          </div>
        )}

        {/* Text input for later stages */}
        {chatStage >= 1 && (
          <div className={styles.chatInputRow}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={handleSend}
              placeholder="Type your message..."
              disabled={creatingPlan || polling || loading || isTyping}
              size="large"
              className={styles.chatInput}
            />
            <Button 
              type="primary" 
              onClick={handleSend} 
              disabled={creatingPlan || polling || loading || !input.trim() || isTyping}
              size="large"
              className={styles.sendButton}
            >
              Send
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LearningPath;