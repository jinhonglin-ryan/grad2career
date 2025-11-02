import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, LogOut, ArrowLeft, BookOpen, Save, Check } from 'lucide-react';
import { Spin, Alert, Input, Button, message } from 'antd';
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
  const videoDate = state?.date;
  const learningPathId = state?.learningPathId;

  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<string>('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [updating, setUpdating] = useState(false);

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
    // Load notes and completion status from localStorage
    try {
      const stored = localStorage.getItem(`video_notes_${vid}`);
      if (stored) setNotes(stored);
      const completedStatus = localStorage.getItem(`video_completed_${vid}`);
      if (completedStatus === 'true') setCompleted(true);
    } catch { /* ignore */ }
  }, [videoId, video]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesSaved(false);
    try {
      const vid = videoId || video?.videoId;
      if (vid) {
        localStorage.setItem(`video_notes_${vid}`, value);
        setTimeout(() => setNotesSaved(true), 500);
      }
    } catch { /* ignore */ }
  };

  const handleMarkComplete = async () => {
    const vid = videoId || video?.videoId;
    if (!vid) return;
    
    const newCompleted = !completed;
    setCompleted(newCompleted);
    
    // Save to localStorage first
    try {
      localStorage.setItem(`video_completed_${vid}`, String(newCompleted));
    } catch { /* ignore */ }
    
    // Also sync to backend if we have learningPathId and date
    if (learningPathId && videoDate) {
      try {
        setUpdating(true);
        await api.patch(`/learning/learning-paths/${learningPathId}/progress`, {
          videoId: vid,
          date: videoDate,
          completed: newCompleted,
          notes: notes || undefined,
        });
        message.success(newCompleted ? 'Video marked as completed!' : 'Completion status removed');
      } catch (error: any) {
        console.error('Failed to update progress:', error);
        // Don't revert, keep localStorage change
        message.warning('Saved locally. Will sync when you return to Learning Path.');
      } finally {
        setUpdating(false);
      }
    } else {
      message.success(newCompleted ? 'Video marked as completed!' : 'Completion status removed');
    }
  };

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
            <button 
              onClick={() => navigate('/learning', { state: { career: state?.career } })} 
              className={styles.dashboardNavButton}
            >
              <ArrowLeft size={18} />
              Back to Learning Path
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
          <div>
            <h1>{video?.title || 'Video Player'}</h1>
            <p className={styles.breadcrumb}>
              <BookOpen size={16} />
              Learning Path / Video
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Button
              type={completed ? 'default' : 'primary'}
              icon={completed ? <Check size={16} /> : undefined}
              onClick={handleMarkComplete}
              size="large"
              className={completed ? styles.completedButton : ''}
              loading={updating}
            >
              {completed ? 'Completed ✓' : 'Mark as Complete'}
            </Button>
          </div>
        </div>

        {!embedSrc ? (
          <Alert type="error" message="Invalid video information" showIcon />
        ) : (
          <div className={styles.videoDetailGrid}>
            <div className={styles.videoPlayerCard}>
              <div className={styles.videoWrapper}>
                <iframe
                  src={embedSrc}
                  title="YouTube video player"
                  className={styles.videoIframe}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
            
            <div className={styles.videoSidebar}>
              <div className={styles.transcriptCard}>
                <div className={styles.cardHeader}>
                  <h3>📝 Transcript</h3>
                </div>
                <div className={styles.transcriptContent}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <Spin />
                    </div>
                  ) : transcript && transcript.length > 0 ? (
                    <div className={styles.transcriptList}>
                      {transcript.map((t, i) => (
                        <div key={i} className={styles.transcriptItem}>
                          {t.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert type="info" message="Transcript not available for this video." showIcon />
                  )}
                </div>
              </div>
              
              <div className={styles.notesCard}>
                <div className={styles.cardHeader}>
                  <h3>✍️ Your Notes</h3>
                  {!notesSaved && (
                    <span className={styles.savingIndicator}>
                      <Save size={14} /> Saving...
                    </span>
                  )}
                  {notesSaved && notes && (
                    <span className={styles.savedIndicator}>
                      <Check size={14} /> Saved
                    </span>
                  )}
                </div>
                <Input.TextArea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  rows={8}
                  placeholder="Write your notes here while watching the video..."
                  className={styles.notesTextarea}
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


