import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, LogOut } from 'lucide-react';
import { Spin, Alert, Input } from 'antd';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import styles from './LearningPath.module.css';

type TranscriptItem = { text: string; start?: number; duration?: number };

const VideoDetail = () => {
  const { videoId } = useParams();
  const { state } = useLocation() as any;
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const video = state?.video as { videoId: string; title: string; url: string } | undefined;

  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    const vid = videoId || video?.videoId;
    if (!vid) {
      setLoading(false);
      return;
    }
    // Fetch transcript from backend
    const fetchTranscript = async () => {
      try {
        const resp = await api.get(`/youtube/transcript/${vid}`);
        const data = resp.data;
        if (!data || !Array.isArray(data.transcript)) throw new Error('Invalid transcript format');
        setTranscript(data.transcript.map((d: any) => ({ text: d.text, start: d.start, duration: d.duration })));
      } catch (e: any) {
        setTranscript(null);
      } finally {
        setLoading(false);
      }
    };
    fetchTranscript();
    // Load notes from localStorage
    try {
      const stored = localStorage.getItem(`video_notes_${vid}`);
      if (stored) setNotes(stored);
    } catch { /* ignore */ }
  }, [videoId, video]);

  const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}` : (video ? `https://www.youtube.com/embed/${video.videoId}` : '');

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => navigate('/dashboard')}>
            <Briefcase className={styles.logoIcon} />
            <span className={styles.logoText}>SkillBridge</span>
          </div>
          <div className={styles.navRight}>
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
          <h1>Video</h1>
          {video?.title && <p>{video.title}</p>}
        </div>

        {!embedSrc ? (
          <Alert type="error" message="Invalid video information" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e5e7eb' }}>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '0.5rem' }}>
                <iframe
                  src={embedSrc}
                  title="YouTube video player"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e5e7eb', maxHeight: 360, overflow: 'auto' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Transcript</h3>
                {loading ? (
                  <Spin />
                ) : transcript && transcript.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {transcript.map((t, i) => (
                      <div key={i} style={{ color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>{t.text}</div>
                    ))}
                  </div>
                ) : (
                  <Alert type="info" message="Transcript not available for this video." />
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e5e7eb' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Notes</h3>
                <Input.TextArea
                  value={notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNotes(val);
                    try {
                      const vid = videoId || video?.videoId;
                      if (vid) localStorage.setItem(`video_notes_${vid}`, val);
                    } catch { /* ignore */ }
                  }}
                  rows={6}
                  placeholder="Write your notes here while watching…"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoDetail;


