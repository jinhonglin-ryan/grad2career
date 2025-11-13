import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, Target, TrendingUp, BookOpen, User, Sparkles, ArrowRight, CheckCircle2, Edit2, HardHat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from './Dashboard.module.css';

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
    current_zip_code?: string;
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
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    previous_job_title?: string;
    mining_type?: string;
    years_mining_experience?: number;
  }>({});

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
          // Initialize edit data (only mining-specific fields for dashboard)
          setEditData({
            previous_job_title: profileResponse.data.profile?.previous_job_title || '',
            mining_type: profileResponse.data.profile?.mining_type || '',
            years_mining_experience: profileResponse.data.profile?.years_mining_experience || undefined,
          });
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

  const handleSaveEdit = async (section: string) => {
    try {
      await api.put('/auth/user/profile', editData);
      toast.success('Profile updated successfully!');
      
      // Refresh profile data
      const profileResponse = await api.get('/auth/user/profile');
      setFullProfile(profileResponse.data);
      setEditingSection(null);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    if (fullProfile) {
      setEditData({
        previous_job_title: fullProfile.profile?.previous_job_title || '',
        mining_type: fullProfile.profile?.mining_type || '',
        years_mining_experience: fullProfile.profile?.years_mining_experience || undefined,
      });
    }
    setEditingSection(null);
  };

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
          <div className={styles.logo} onClick={() => navigate('/')}>
            <div className={styles.logoIconWrapper}>
              <Briefcase className={styles.logoIcon} />
            </div>
            <span className={styles.logoText}>SkillBridge</span>
          </div>
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
                  strokeDasharray="339.292"
                  strokeDashoffset="100"
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
              {!editingSection && (
                <button 
                  className={styles.editIconButton}
                  onClick={() => setEditingSection('mining')}
                  title="Edit mining information"
                >
                  <Edit2 size={18} />
                </button>
              )}
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
            {(fullProfile?.profile?.previous_job_title || fullProfile?.profile?.mining_type || editingSection === 'mining') && (
              <div className={styles.miningInfoSection}>
                <div className={styles.sectionTitle}>
                  <HardHat size={20} />
                  <h3>Mining Background</h3>
                </div>
                {editingSection === 'mining' ? (
                  <div className={styles.editForm}>
                    <div className={styles.formGroup}>
                      <label>Previous Mining Job Title</label>
                      <input
                        type="text"
                        value={editData.previous_job_title || ''}
                        onChange={(e) => setEditData({ ...editData, previous_job_title: e.target.value })}
                        placeholder="e.g., Continuous Miner Operator"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Mining Type</label>
                      <select
                        value={editData.mining_type || ''}
                        onChange={(e) => setEditData({ ...editData, mining_type: e.target.value })}
                        className={styles.input}
                      >
                        <option value="">Select type</option>
                        <option value="underground">Underground</option>
                        <option value="surface">Surface</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Years of Experience</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={editData.years_mining_experience || ''}
                        onChange={(e) => setEditData({ ...editData, years_mining_experience: parseInt(e.target.value) || undefined })}
                        placeholder="Years"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.editActions}>
                      <button onClick={() => handleSaveEdit('mining')} className={styles.saveButton}>
                        Save
                      </button>
                      <button onClick={handleCancelEdit} className={styles.cancelButton}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                )}
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
                onClick={() => {
                  navigate('/assessment');
                }}
              >
                {skillProfile?.has_assessment ? 'Update Assessment' : 'Start Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
