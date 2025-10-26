import { useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, Target, TrendingUp, BookOpen, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
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
          <div>
            <h1>Welcome back, {user?.name?.split(' ')[0] || 'there'}!</h1>
            <p>Continue your journey to a new career</p>
          </div>
        </div>

        <div className={styles.quickActions}>
          <div
            className={styles.actionCard}
            onClick={() => navigate('/assessment')}
          >
            <div className={styles.cardIcon} style={{ background: '#dbeafe' }}>
              <Target size={32} color="#1e40af" />
            </div>
            <h3>Skill Assessment</h3>
            <p>Identify and document your transferable skills with our AI assistant</p>
            <button className={styles.actionButton}>Start Assessment</button>
          </div>

          <div
            className={styles.actionCard}
            onClick={() => navigate('/careers')}
          >
            <div className={styles.cardIcon} style={{ background: '#fef3c7' }}>
              <TrendingUp size={32} color="#92400e" />
            </div>
            <h3>Find Careers</h3>
            <p>Discover careers that match your skills and see what you need to learn</p>
            <button className={styles.actionButton}>Explore Careers</button>
          </div>

          <div
            className={styles.actionCard}
            onClick={() => navigate('/learning')}
          >
            <div className={styles.cardIcon} style={{ background: '#d1fae5' }}>
              <BookOpen size={32} color="#065f46" />
            </div>
            <h3>Learning Path</h3>
            <p>Follow your personalized training plan to reach your career goals</p>
            <button className={styles.actionButton}>View Path</button>
          </div>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoCard}>
            <h2>Your Journey</h2>
            <div className={styles.journeySteps}>
              <div className={styles.journeyStep}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h4>Assess Your Skills</h4>
                  <p>Chat with our AI to build your skill profile</p>
                </div>
              </div>
              <div className={styles.journeyStep}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h4>Explore Careers</h4>
                  <p>Find jobs that match your skills and interests</p>
                </div>
              </div>
              <div className={styles.journeyStep}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h4>Follow Your Path</h4>
                  <p>Complete training to fill skill gaps</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <User size={48} />
              <h2>Your Profile</h2>
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileItem}>
                <span className={styles.label}>Name</span>
                <span className={styles.value}>{user?.name || 'Not set'}</span>
              </div>
              <div className={styles.profileItem}>
                <span className={styles.label}>Email</span>
                <span className={styles.value}>{user?.email}</span>
              </div>
              <div className={styles.profileItem}>
                <span className={styles.label}>Skills Identified</span>
                <span className={styles.value}>
                  {user?.skillProfile?.skills?.length || 0} skills
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

