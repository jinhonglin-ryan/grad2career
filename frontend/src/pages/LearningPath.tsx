import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BookOpen, Clock, CheckCircle, MessageSquare, ArrowLeft, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Calendar, Badge, Input, Button, Spin, Empty, Modal, Steps, Progress, Checkbox, Tooltip, message } from 'antd';
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
  const [chatStage, setChatStage] = useState<0 | 1 | 2 | 3>(0);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<Array<{ label?: string; text?: string; status?: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  
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
          `What does your weekly availability look like?`;
        
        setIsTyping(true);
        setTimeout(() => {
          setMessages([{ role: 'bot', text: welcomeMessage }]);
          setIsTyping(false);
          setChatStage(0);
        }, 800);
      }
    }
  }, [loading, scheduled.length, career, savedCareerTitle]);

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

    // Stage 0 -> acknowledge schedule
    if (chatStage === 0) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          { role: 'bot', text: `I see your schedule is: ${trimmed}. Anything else to add? (e.g., preferred learning times, specific topics)` },
        ]);
        setIsTyping(false);
        setChatStage(1);
      }, 500);
      return;
    }

    // Stage 1 -> begin real agent call on next user input
    if (chatStage === 1) {
      setIsTyping(true);
      setTimeout(async () => {
        setMessages((m) => [
          ...m,
          { role: 'bot', text: 'Got it! 🚀 Generating a tailored plan with resources and videos...' },
        ]);
        setIsTyping(false);
        setChatStage(2);
        
        // Fire real job
        try {
          setCreatingPlan(true);
          setStepsExpanded(true);
          const resp = await api.post('/agent/ask', {
            query: `Create a beginner solar panel installer technician learning plan with 10 useful YouTube videos and resources. User note: ${trimmed}`,
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
      return;
    }

    // If already generating or generated, keep chat as general
    if (chatStage >= 2) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', text: 'Working on it. I will update the plan shortly.' }]);
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
    const videos = extractVideos(res);
    if (!videos || videos.length === 0) {
      setMessages((m) => [...m, { role: 'bot', text: 'No videos found. Please try again.' }]);
      return;
    }
    const topFive = videos.slice(0, 5);
    const start = dayjs();
    const plan: ScheduledVideo[] = topFive.map((v, idx) => ({
      date: start.add(idx, 'day').format('YYYY-MM-DD'),
      video: v,
      completed: false,
    }));
    setScheduled(plan);
    setChatStage(3);
    setMessages((m) => [...m, { role: 'bot', text: 'Plan created! I placed 5 starter videos on your calendar.' }]);
    
    // Save to backend
    await saveLearningPath(plan);
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

  const cellRender = (current: Dayjs, info: any) => {
    // Only render for date cells, not month cells
    if (info.type !== 'date') return info.originNode;
    
    const key = dateKey(current);
    const items = itemsByDate[key] || [];
    if (items.length === 0) return null;
    
    return (
      <ul className={styles.eventsList}>
        {items.map((item) => (
          <li 
            key={`${item.video.videoId}-${item.date}`} 
            className={`${styles.eventItem} ${item.completed ? styles.eventItemCompleted : ''}`}
          >
            <div className={styles.eventItemContent}>
              <Checkbox
                checked={item.completed || false}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleVideoCompletion(item.video, item.date);
                }}
                className={styles.eventCheckbox}
              />
              <Tooltip title={item.completed ? 'Click to watch again' : 'Click to watch'}>
                <span 
                  onClick={() => navigate(`/learning/video/${item.video.videoId}`, { 
                    state: { 
                      video: item.video, 
                      career,
                      date: item.date,
                      learningPathId: learningPathId
                    } 
                  })}
                  className={styles.eventTitle}
                >
                  <Badge 
                    status={item.completed ? 'success' : 'processing'} 
                    text={item.video.title} 
                  />
                </span>
              </Tooltip>
            </div>
          </li>
        ))}
      </ul>
    );
  };

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
          <h2>Required Skills for {career?.title || savedCareerTitle || 'Solar Panel Installer Technician'}</h2>
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
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <Calendar fullscreen={false} cellRender={cellRender} />
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
        
        <div className={styles.chatInputRow}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder={
              chatStage === 0 
                ? 'e.g., "I can study 2 hours on weekdays, 4 hours on weekends"' 
                : chatStage === 1
                ? 'e.g., "I prefer video tutorials in the evening"'
                : 'Type your message...'
            }
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
      </Modal>
    </div>
  );
};

export default LearningPath;