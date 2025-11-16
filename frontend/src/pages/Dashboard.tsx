import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Target, TrendingUp, BookOpen, User, Sparkles, ArrowRight, CheckCircle2, HardHat, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Logo from '../components/Logo';
import styles from './Dashboard.module.css';
import { Modal, Spin, Alert } from 'antd';

interface SkillProfile {
  has_assessment: boolean;
  extracted_skills?: Array<{
    category: string;
    user_phrase: string;
    onet_task_codes: string[];
  }>;
  user_profile?: {
    skills?: string[];
    tools?: string[];
    work_experience?: string;
    previous_job_title?: string;
    mining_role?: string;
    mining_type?: string;
    years_mining_experience?: number;
  };
  updated_at?: string;
}

interface FullProfile {
  user: {
    id: string;
    email: string;
    name?: string;
    onboarding_completed: boolean;
  };
  profile: {
    previous_job_title?: string;
    mining_role?: string;
    mining_type?: string;
    years_mining_experience?: number;
    work_experience?: string;
    career_goals?: string;
  } | null;
  metadata: {
    state?: string;
    travel_constraint?: string;
    budget_constraint?: string;
    scheduling?: string;
    weekly_hours_constraint?: string;
    transition_goal?: string;
    transition_goal_text?: string;
    target_sector?: string;
  };
}

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [skillProfile, setSkillProfile] = useState<SkillProfile | null>(null);
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantName, setGrantName] = useState<string>('');
  const [grantResult, setGrantResult] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch skill profile
        const skillResponse = await api.get(`/skills/profile/${user.id}`);
        setSkillProfile(skillResponse.data);

        // Fetch full profile for mining-specific data
        try {
          const profileResponse = await api.get('/auth/user/profile');
          setFullProfile(profileResponse.data);
        } catch (error) {
          console.error('Error fetching full profile:', error);
        }
      } catch (error) {
        console.error('Error fetching skill profile:', error);
        setSkillProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleOpenGrant = async (name: string) => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    setGrantName(name);
    setGrantModalOpen(true);
    setGrantLoading(true);
    setGrantError(null);
    setGrantResult(null);
    try {
      const resp = await api.post('/subsidy/evaluate', {
        user_id: user.id,
        grant_name: name,
        session_id: 'default',
      });
      const data = resp.data;
      if (data?.status === 'success') {
        setGrantResult(data.data || null);
      } else {
        setGrantError(data?.message || 'Failed to evaluate grant.');
      }
    } catch (e: any) {
      setGrantError(e?.response?.data?.detail || e?.message || 'Request failed');
    } finally {
      setGrantLoading(false);
    }
  };

  const CIRCUMFERENCE = 339.292;
  const progressPercent = skillProfile?.has_assessment ? 100 : 25;
  const progressOffset = CIRCUMFERENCE * (1 - progressPercent / 100);


  return (
    <div className={styles.container}>
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Logo variant="icon" onClick={() => navigate('/dashboard')} />
          <div className={styles.navRight}>
            <div className={styles.userInfo} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
              <div className={styles.userAvatar}>
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <span className={styles.userName}>{user?.name || user?.email}</span>
            </div>
            <button onClick={logout} className={styles.logoutButton}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className={styles.mainContent}>
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeBadge}>
              <Sparkles size={16} />
              <span>Welcome Back!</span>
            </div>
            <h1 className={styles.welcomeTitle}>
              Hello, {user?.name?.split(' ')[0] || 'there'}!
            </h1>
            <p className={styles.welcomeText}>
              Ready to continue your career transformation journey?
            </p>
          </div>
          <div className={styles.welcomeVisual}>
            <div className={styles.progressRing}>
              <svg width="120" height="120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={progressOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </svg>
              <div className={styles.progressText}>
                <span className={styles.progressPercent}>
                  {skillProfile?.has_assessment ? '100%' : '25%'}
                </span>
                <span className={styles.progressLabel}>Complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.sectionHeader}>
          <h2>Quick Actions</h2>
          <p>Choose where you'd like to continue</p>
        </div>

        <div className={styles.quickActions}>
          <div
            className={`${styles.actionCard} ${styles.primary}`}
            onClick={() => navigate('/assessment')}
          >
            <div className={styles.cardIconWrapper}>
              <Target size={28} />
            </div>
            <div className={styles.cardContent}>
              <h3>Skill Assessment</h3>
              <p>
                {skillProfile?.has_assessment 
                  ? `You have ${skillProfile.extracted_skills?.length || 0} identified skills. Click to view or update.`
                  : 'Identify and document your transferable skills with our AI assistant'}
              </p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>
                  {skillProfile?.has_assessment 
                    ? `${skillProfile.extracted_skills?.length || 0} skills identified`
                    : '~15 minutes'}
                </span>
              </div>
            </div>
            <ArrowRight className={styles.cardArrow} size={24} />
          </div>

          <div
            className={`${styles.actionCard} ${styles.secondary}`}
            onClick={() => navigate('/careers')}
          >
            <div className={styles.cardIconWrapper}>
              <TrendingUp size={28} />
            </div>
            <div className={styles.cardContent}>
              <h3>Find Careers</h3>
              <p>Discover careers that match your skills and see what you need to learn</p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>100+ career paths</span>
              </div>
            </div>
            <ArrowRight className={styles.cardArrow} size={24} />
          </div>

          <div
            className={`${styles.actionCard} ${styles.tertiary}`}
            onClick={() => navigate('/learning')}
          >
            <div className={styles.cardIconWrapper}>
              <BookOpen size={28} />
            </div>
            <div className={styles.cardContent}>
              <h3>Learning Path</h3>
              <p>Follow your personalized training plan to reach your career goals</p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>Personalized plan</span>
              </div>
            </div>
            <ArrowRight className={styles.cardArrow} size={24} />
          </div>

          <div
            className={`${styles.actionCard} ${styles.quaternary}`}
            onClick={() => navigate('/training')}
          >
            <div className={styles.cardIconWrapper}>
              <Zap size={28} />
            </div>
            <div className={styles.cardContent}>
              <h3>Training Programs</h3>
              <p>Discover training programs for coal miners transitioning to renewable energy careers</p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>Coal miner transition and renewable energy programs</span>
              </div>
            </div>
            <ArrowRight className={styles.cardArrow} size={24} />
          </div>
        </div>

        {/* Available Grants */}
        <div className={styles.sectionHeader}>
          <h2>Available Grants</h2>
          <p>Explore support programs tailored for energy transition</p>
        </div>
        <div className={styles.grantsGrid}>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('POWER Dislocated Worker Grants')}>
            <img src="/grants/power-dwg.png" alt="POWER Dislocated Worker Grants" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>POWER Dislocated Worker Grants</h3>
              <p className={styles.grantSubtitle}>U.S. Department of Labor</p>
            </div>
          </div>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('Assistance to Coal Communities (ACC)')}>
            <img src="/grants/acc-eda.png" alt="Assistance to Coal Communities (ACC)" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>Assistance to Coal Communities (ACC)</h3>
              <p className={styles.grantSubtitle}>Economic Development Administration (EDA)</p>
            </div>
          </div>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('Just Transition Program – Colorado')}>
            <img src="/grants/just-transition-co.png" alt="Just Transition Program – Colorado" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>Just Transition Program – Colorado</h3>
              <p className={styles.grantSubtitle}>Colorado Department of Labor and Employment</p>
            </div>
          </div>
        </div>

        {/* Info Sections */}
        <div className={styles.infoSection}>
          <div className={styles.journeyCard}>
            <div className={styles.cardHeader}>
              <h2>Your Journey</h2>
              <span className={styles.badge}>Step-by-Step Guide</span>
            </div>
            <div className={styles.journeySteps}>
              <div className={`${styles.journeyStep} ${styles.completed}`}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                  <div className={styles.stepLine}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Create Account</h4>
                  <p>Sign up and set up your profile</p>
                  <span className={styles.stepStatus}>Completed ✓</span>
                </div>
              </div>

              <div className={`${styles.journeyStep} ${skillProfile?.has_assessment ? styles.completed : styles.current}`}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                  <div className={styles.stepLine}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Assess Your Skills</h4>
                  <p>Chat with our AI to build your skill profile</p>
                  {skillProfile?.has_assessment ? (
                    <span className={styles.stepStatus}>Completed ✓</span>
                  ) : (
                    <button 
                      className={styles.stepAction}
                      onClick={() => navigate('/assessment')}
                    >
                      Start Now →
                    </button>
                  )}
                </div>
              </div>

              <div className={`${styles.journeyStep} ${skillProfile?.has_assessment ? styles.current : ''}`}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                  <div className={styles.stepLine}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Explore Careers</h4>
                  <p>Find jobs that match your skills and interests</p>
                  {skillProfile?.has_assessment && (
                    <button 
                      className={styles.stepAction}
                      onClick={() => navigate('/careers')}
                    >
                      Explore Now →
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.journeyStep}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Complete Training</h4>
                  <p>Follow your personalized learning path</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.cardHeader}>
              <h2>Your Mining Profile</h2>
            </div>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div>
                <h3>{user?.name || 'User'}</h3>
                <p>{user?.email}</p>
              </div>
            </div>

            {/* Mining-Specific Information */}
            {(fullProfile?.profile?.previous_job_title || fullProfile?.profile?.mining_type || fullProfile?.profile?.years_mining_experience) && (
              <div className={styles.miningInfoSection}>
                <div className={styles.sectionTitle}>
                  <HardHat size={20} />
                  <h3>Mining Background</h3>
                </div>
                <div className={styles.infoGrid}>
                  {fullProfile?.profile?.previous_job_title && (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Previous Job</span>
                      <span className={styles.value}>{fullProfile.profile.previous_job_title}</span>
                    </div>
                  )}
                  {fullProfile?.profile?.mining_type && (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Mining Type</span>
                      <span className={styles.value}>{fullProfile.profile.mining_type}</span>
                    </div>
                  )}
                  {fullProfile?.profile?.years_mining_experience && (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Experience</span>
                      <span className={styles.value}>{fullProfile.profile.years_mining_experience} years</span>
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className={styles.profileInfo}>
              <div className={styles.profileItem}>
                <div className={styles.itemIcon}>
                  <Target size={18} />
                </div>
                <div>
                  <span className={styles.label}>Skills Identified</span>
                  <span className={styles.value}>
                    {loading ? 'Loading...' : 
                     skillProfile?.has_assessment 
                       ? `${skillProfile.extracted_skills?.length || skillProfile.user_profile?.skills?.length || 0} skills`
                       : '0 skills'}
                  </span>
                </div>
              </div>
              <div className={styles.profileItem}>
                <div className={styles.itemIcon}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <span className={styles.label}>Career Matches</span>
                  <span className={styles.value}>
                    {skillProfile?.has_assessment ? 'Ready to explore' : 'Pending assessment'}
                  </span>
                </div>
              </div>
              <div className={styles.profileItem}>
                <div className={styles.itemIcon}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <span className={styles.label}>Learning Progress</span>
                  <span className={styles.value}>Not started</span>
                </div>
              </div>
            </div>
            {skillProfile?.has_assessment && skillProfile.extracted_skills && skillProfile.extracted_skills.length > 0 && (
              <div className={styles.skillsPreview}>
                <h4>Top Skills:</h4>
                <div className={styles.skillTags}>
                  {skillProfile.extracted_skills.slice(0, 3).map((skill, index) => (
                    <span key={index} className={styles.skillTag}>
                      {skill.user_phrase.substring(0, 30)}
                      {skill.user_phrase.length > 30 ? '...' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.profileActions}>
              <button 
                type="button"
                className={styles.editButton} 
                onClick={() => navigate('/profile')}
              >
                <User size={18} />
                View Full Profile
              </button>
              <button 
                type="button"
                className={styles.secondaryButton} 
                onClick={async () => {
                  // Clear previous assessment data when retaking
                  if (skillProfile?.has_assessment) {
                    try {
                      // Call backend to clear assessment data
                      await api.delete('/skills/clear-assessment');
                      toast.info('Previous assessment cleared. Starting new assessment...');
                    } catch (error) {
                      console.error('Error clearing assessment:', error);
                      // Continue to assessment page anyway
                    }
                  }
                  navigate('/assessment');
                }}
              >
                {skillProfile?.has_assessment ? 'Retake Assessment' : 'Start Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Grant Modal */}
      <Modal
        open={grantModalOpen}
        onCancel={() => setGrantModalOpen(false)}
        footer={null}
        title={`Grant Evaluation: ${grantName || ''}`}
        width={720}
      >
        {grantLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spin tip="Evaluating eligibility..." />
          </div>
        ) : grantError ? (
          <Alert type="error" message={grantError} />
        ) : grantResult ? (
          <div>
            <h3 style={{ marginBottom: '0.75rem' }}>Checklist</h3>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {(grantResult.checklist || []).map((item: any, idx: number) => (
                <li key={idx} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600 }}>
                    {item.requirement}{' '}
                    <span style={{ color: item.satisfied ? '#10b981' : '#dc2626' }}>
                      {item.satisfied ? '✓' : '✗'}
                    </span>
                  </div>
                  {item.rationale && (
                    <div style={{ color: '#475569', fontSize: '0.9rem' }}>{item.rationale}</div>
                  )}
                </li>
              ))}
            </ul>

            <h3 style={{ marginTop: '1.25rem', marginBottom: '0.75rem' }}>Sources</h3>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {(grantResult.sources || []).map((src: any, idx: number) => (
                <li key={idx} style={{ marginBottom: '0.5rem' }}>
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    {src.title || src.url}
                  </a>
                  {src.snippet && <div style={{ color: '#475569', fontSize: '0.9rem' }}>{src.snippet}</div>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Alert type="info" message="No result returned." />
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

// Grant Modal (rendered at the end to avoid layout nesting issues)
// Note: Keep outside of main return if you prefer a portal; here appended above footer.

