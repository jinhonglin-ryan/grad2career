import { useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, Target, TrendingUp, BookOpen, User, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => navigate('/')}>
            <div className={styles.logoIconWrapper}>
              <Briefcase className={styles.logoIcon} />
            </div>
            <span className={styles.logoText}>SkillBridge</span>
          </div>
          <div className={styles.navRight}>
            <div className={styles.userInfo}>
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
                <span className={styles.progressPercent}>70%</span>
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
              <p>Identify and document your transferable skills with our AI assistant</p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>~15 minutes</span>
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

              <div className={`${styles.journeyStep} ${styles.current}`}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                  <div className={styles.stepLine}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Assess Your Skills</h4>
                  <p>Chat with our AI to build your skill profile</p>
                  <button 
                    className={styles.stepAction}
                    onClick={() => navigate('/assessment')}
                  >
                    Start Now →
                  </button>
                </div>
              </div>

              <div className={styles.journeyStep}>
                <div className={styles.stepIndicator}>
                  <div className={styles.stepDot}></div>
                  <div className={styles.stepLine}></div>
                </div>
                <div className={styles.stepDetails}>
                  <h4>Explore Careers</h4>
                  <p>Find jobs that match your skills and interests</p>
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
              <h2>Your Profile</h2>
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
            <div className={styles.profileInfo}>
              <div className={styles.profileItem}>
                <div className={styles.itemIcon}>
                  <Target size={18} />
                </div>
                <div>
                  <span className={styles.label}>Skills Identified</span>
                  <span className={styles.value}>
                    {user?.skillProfile?.skills?.length || 0} skills
                  </span>
                </div>
              </div>
              <div className={styles.profileItem}>
                <div className={styles.itemIcon}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <span className={styles.label}>Career Matches</span>
                  <span className={styles.value}>Pending assessment</span>
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
            <button className={styles.editButton} onClick={() => navigate('/assessment')}>
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
