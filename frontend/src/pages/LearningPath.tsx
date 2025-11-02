import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, LogOut, BookOpen, Clock, DollarSign, ExternalLink, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './LearningPath.module.css';

interface Resource {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'workshop' | 'bootcamp';
  platform: string;
  duration: string;
  cost: string;
  url: string;
  skills: string[];
}

interface WeekPlan {
  week: number;
  title: string;
  resources: Resource[];
  estimatedHours: number;
}

const LearningPath = () => {
  const [learningPath, setLearningPath] = useState<WeekPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set());
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const career = location.state?.career;

  useEffect(() => {
    if (!career) {
      navigate('/careers');
      return;
    }
    fetchLearningPath();
  }, [career]);

  const fetchLearningPath = async () => {
    try {
      const response = await api.post('/learning/path', {
        careerId: career.id,
        missingSkills: career.missingSkills,
      });
      setLearningPath(response.data.path || mockLearningPath);
    } catch (error) {
      console.error('Error fetching learning path:', error);
      setLearningPath(mockLearningPath);
    } finally {
      setLoading(false);
    }
  };

  const toggleWeekCompletion = (week: number) => {
    setCompletedWeeks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(week)) {
        newSet.delete(week);
      } else {
        newSet.add(week);
      }
      return newSet;
    });
  };

  const totalHours = learningPath.reduce((sum, week) => sum + week.estimatedHours, 0);
  const completionPercentage = (completedWeeks.size / learningPath.length) * 100;

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Generating your personalized learning path...</p>
      </div>
    );
  }

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
          <h1>Your Learning Path</h1>
          <p>Personalized plan to become a {career?.title}</p>
        </div>

        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <BookOpen size={24} />
            <div>
              <div className={styles.summaryNumber}>{learningPath.length}</div>
              <div className={styles.summaryLabel}>Weeks</div>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <Clock size={24} />
            <div>
              <div className={styles.summaryNumber}>{totalHours}</div>
              <div className={styles.summaryLabel}>Total Hours</div>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <CheckCircle size={24} />
            <div>
              <div className={styles.summaryNumber}>{completionPercentage.toFixed(0)}%</div>
              <div className={styles.summaryLabel}>Complete</div>
            </div>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>

        <div className={styles.timeline}>
          {learningPath.map((weekPlan) => (
            <div
              key={weekPlan.week}
              className={`${styles.weekCard} ${
                completedWeeks.has(weekPlan.week) ? styles.completed : ''
              }`}
            >
              <div className={styles.weekHeader}>
                <div className={styles.weekTitle}>
                  <h2>Week {weekPlan.week}</h2>
                  <h3>{weekPlan.title}</h3>
                </div>
                <button
                  onClick={() => toggleWeekCompletion(weekPlan.week)}
                  className={styles.completeButton}
                >
                  {completedWeeks.has(weekPlan.week) ? (
                    <>
                      <CheckCircle size={18} />
                      Completed
                    </>
                  ) : (
                    'Mark Complete'
                  )}
                </button>
              </div>

              <div className={styles.weekMeta}>
                <span>
                  <Clock size={16} />
                  {weekPlan.estimatedHours} hours
                </span>
              </div>

              <div className={styles.resources}>
                {weekPlan.resources.map((resource) => (
                  <div key={resource.id} className={styles.resourceCard}>
                    <div className={styles.resourceHeader}>
                      <h4>{resource.title}</h4>
                      <span className={styles.resourceType}>{resource.type}</span>
                    </div>
                    <p className={styles.platform}>{resource.platform}</p>
                    <div className={styles.resourceMeta}>
                      <span>
                        <Clock size={14} />
                        {resource.duration}
                      </span>
                      <span>
                        <DollarSign size={14} />
                        {resource.cost}
                      </span>
                    </div>
                    <div className={styles.skillTags}>
                      {resource.skills.map((skill, index) => (
                        <span key={index} className={styles.skillTag}>
                          {skill}
                        </span>
                      ))}
                    </div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.resourceLink}
                    >
                      View Resource
                      <ExternalLink size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mock learning path data
const mockLearningPath: WeekPlan[] = [
  {
    week: 1,
    title: 'Foundations of Solar Energy',
    estimatedHours: 10,
    resources: [
      {
        id: '1',
        title: 'Solar Energy Basics',
        type: 'course',
        platform: 'Coursera',
        duration: '4 weeks',
        cost: 'Free',
        url: 'https://www.coursera.org',
        skills: ['Solar Technology', 'Energy Systems'],
      },
      {
        id: '2',
        title: 'Introduction to Photovoltaics',
        type: 'course',
        platform: 'edX',
        duration: '6 weeks',
        cost: '$49',
        url: 'https://www.edx.org',
        skills: ['PV Systems', 'Solar Panels'],
      },
    ],
  },
  {
    week: 2,
    title: 'Electrical Systems for Solar',
    estimatedHours: 12,
    resources: [
      {
        id: '3',
        title: 'Basic Electrical Theory',
        type: 'course',
        platform: 'YouTube',
        duration: '3 hours',
        cost: 'Free',
        url: 'https://www.youtube.com',
        skills: ['Electrical Systems', 'Wiring'],
      },
      {
        id: '4',
        title: 'Solar Electrical Installation',
        type: 'workshop',
        platform: 'Local Technical College',
        duration: '2 days',
        cost: '$200',
        url: '#',
        skills: ['Installation', 'Safety Protocols'],
      },
    ],
  },
  {
    week: 3,
    title: 'NABCEP Certification Prep',
    estimatedHours: 15,
    resources: [
      {
        id: '5',
        title: 'NABCEP PV Installation Professional',
        type: 'certification',
        platform: 'NABCEP',
        duration: '4 weeks',
        cost: '$1,200',
        url: 'https://www.nabcep.org',
        skills: ['NABCEP Certification', 'Professional Standards'],
      },
    ],
  },
];

export default LearningPath;

