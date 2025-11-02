import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, LogOut, BookOpen, Clock, CheckCircle, MessageSquare, ArrowLeft } from 'lucide-react';
import { Calendar, Badge, Input, Button, Spin, Empty, Modal, Steps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './LearningPath.module.css';

type VideoItem = {
  videoId: string;
  title: string;
  url: string;
};

type ScheduledVideo = {
  date: string; // ISO date string (yyyy-mm-dd)
  video: VideoItem;
};

type AgentStatus = {
  status: 'running' | 'completed' | 'error';
  steps?: Array<{ text?: string; label?: string }>;
  result?: { answer?: string };
  error?: string;
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

  // Floating chat states
  const [modalOpen, setModalOpen] = useState(true);
  const [chatStage, setChatStage] = useState<0 | 1 | 2 | 3>(0);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<Array<{ label?: string; text?: string }>>([]);

  useEffect(() => {
    if (!career) {
      navigate('/careers');
      return;
    }
    // Seed first bot message once per mount
    setMessages([
      {
        role: 'bot',
        text:
          `Great! We'll build a starter plan for becoming a ${career?.title || 'Solar Panel Installer Technician'}. ` +
          `We'll focus on basics like ${MOCK_SOLAR_SKILLS.slice(0, 3).join(', ')}. ` +
          `What does your weekly availability look like?`,
      },
    ]);
    setChatStage(0);
  }, [career, navigate]);

  useEffect(() => {
    if (scheduled.length > 0) {
      // Allow modal to be closed once we have a plan
      setModalOpen(false);
    }
  }, [scheduled.length]);

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

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');

    // Stage 0 -> acknowledge schedule
    if (chatStage === 0) {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: `I see your schedule is: ${trimmed}. Anything else to add?` },
      ]);
      setChatStage(1);
      return;
    }

    // Stage 1 -> begin real agent call on next user input
    if (chatStage === 1) {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: 'Got it. Generating a tailored plan with resources and videos...' },
      ]);
      setChatStage(2);
      // Fire real job
      try {
        setCreatingPlan(true);
        const resp = await api.post('/agent/ask', {
          query: `Create a beginner solar panel installer technician learning plan with 10 useful YouTube videos and resources. User note: ${trimmed}`,
          user_id: 'web',
          session_id: 'default',
        });
        const id = resp.data?.job_id;
        if (!id) throw new Error('No job_id returned');
        setPolling(true);
        pollStatus(id);
      } catch (e: any) {
        setPollError(e?.message || 'Failed to start plan generation');
        setCreatingPlan(false);
        setPolling(false);
      }
      return;
    }

    // If already generating or generated, keep chat as general
    if (chatStage >= 2) {
      setMessages((m) => [...m, { role: 'bot', text: 'Working on it. I will update the plan shortly.' }]);
    }
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

        // stream new steps into chat
        const steps = data.steps || [];
        if (steps.length > seen) {
          const newSteps = steps.slice(seen).map((s) => ({
            label: s.label || 'Update',
            text: s.text || '',
          }));
          if (newSteps.length > 0) setAgentSteps((prev) => [...prev, ...newSteps]);
          seen = steps.length;
        }

        if (data.status === 'completed' || data.status === 'error') {
          done = true;
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e: any) {
      setPollError(e?.message || 'Polling failed');
    } finally {
      setPolling(false);
      setCreatingPlan(false);
    }

    if (lastResult) handleAgentCompletion(lastResult);
  };

  const handleAgentCompletion = (res: AgentStatus) => {
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
    }));
    setScheduled(plan);
    setChatStage(3);
    setMessages((m) => [...m, { role: 'bot', text: 'Plan created! I placed 5 starter videos on your calendar.' }]);
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

  const dateCellRender = (value: Dayjs) => {
    const key = dateKey(value);
    const items = itemsByDate[key] || [];
    if (items.length === 0) return null;
    return (
      <ul className={styles.eventsList}>
        {items.map((item) => (
          <li key={`${item.video.videoId}-${item.date}`} className={styles.eventItem} onClick={() => navigate(`/learning/video/${item.video.videoId}`, { state: { video: item.video, career } })}>
            <Badge status="processing" text={item.video.title} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => navigate('/dashboard')}>
            <Briefcase className={styles.logoIcon} />
            <span className={styles.logoText}>SkillBridge</span>
          </div>
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
          <h1>Learning Dashboard</h1>
          <p>Path to become a {career?.title || 'Solar Panel Installer Technician'}</p>
        </div>

        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <BookOpen size={24} />
            <div>
              <div className={styles.summaryNumber}>{scheduled.length || 0}</div>
              <div className={styles.summaryLabel}>Planned Sessions</div>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <Clock size={24} />
            <div>
              <div className={styles.summaryNumber}>{scheduled.length > 0 ? 5 : 0}</div>
              <div className={styles.summaryLabel}>Upcoming Days</div>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <CheckCircle size={24} />
            <div>
              <div className={styles.summaryNumber}>{scheduled.length > 0 ? 0 : 0}%</div>
              <div className={styles.summaryLabel}>Complete</div>
            </div>
          </div>
        </div>

        <section className={styles.skillsSection}>
          <h2>Required Skills (Mock)</h2>
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
              <Calendar fullscreen={false} dateCellRender={dateCellRender} />
            </div>
          )}
        </section>
      </div>

      {/* Onboarding Modal Chat - forced before plan exists */}
      <Modal
        open={modalOpen && scheduled.length === 0}
        onCancel={() => {}}
        closable={false}
        maskClosable={false}
        title={<div className={styles.chatTitle}><MessageSquare size={16} /> Plan Assistant</div>}
        footer={[
          <Button key="primary" type="primary" onClick={() => setModalOpen(false)} disabled={scheduled.length === 0}>
            Start Learning
          </Button>,
        ]}
      >
        <div className={styles.chatBody}>
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === 'bot' ? styles.botMsg : styles.userMsg}>{m.text}</div>
          ))}
          {(creatingPlan || polling) && (
            <div className={styles.botMsg}><Spin size="small" /> Generating your plan…</div>
          )}
          {pollError && <div className={styles.botMsg}>Error: {pollError}</div>}
          {agentSteps.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <Steps
                direction="vertical"
                size="small"
                items={agentSteps.map((s) => ({
                  title: s.label,
                  description: s.text ? s.text.substring(0, 200) : undefined,
                }))}
              />
            </div>
          )}
        </div>
        <div className={styles.chatInputRow}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder={chatStage < 2 ? 'Type your availability…' : 'Send a message'}
            disabled={creatingPlan || polling}
          />
          <Button type="primary" onClick={handleSend} disabled={creatingPlan || polling}>Send</Button>
        </div>
      </Modal>
    </div>
  );
};

export default LearningPath;