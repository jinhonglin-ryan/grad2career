import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, TrendingUp, DollarSign, MapPin, Target, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './CareerMatch.module.css';

interface Career {
  id: string;
  title: string;
  matchScore: number;
  salary: string;
  growth: string;
  location: string;
  requiredSkills: string[];
  missingSkills: string[];
  description: string;
}

const CareerMatch = () => {
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCareerMatches();
  }, []);

  const fetchCareerMatches = async () => {
    try {
      const response = await api.get('/careers/match');
      setCareers(response.data.careers || mockCareers);
    } catch (error) {
      console.error('Error fetching careers:', error);
      // Use mock data for development
      setCareers(mockCareers);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCareer = (career: Career) => {
    setSelectedCareer(career);
  };

  const handleCreateLearningPath = () => {
    if (selectedCareer) {
      navigate('/learning', { state: { career: selectedCareer } });
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Finding your perfect career matches...</p>
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
          <h1>Your Career Matches</h1>
          <p>Based on your skills, here are careers that fit your profile</p>
        </div>

        <div className={styles.content}>
          <div className={styles.careerList}>
            {careers.map((career) => (
              <div
                key={career.id}
                className={`${styles.careerCard} ${
                  selectedCareer?.id === career.id ? styles.selected : ''
                }`}
                onClick={() => handleSelectCareer(career)}
              >
                <div className={styles.cardHeader}>
                  <h3>{career.title}</h3>
                  <div className={styles.matchScore}>
                    {career.matchScore}% Match
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.infoItem}>
                    <DollarSign size={16} />
                    <span>{career.salary}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <TrendingUp size={16} />
                    <span>{career.growth} growth</span>
                  </div>
                  <div className={styles.infoItem}>
                    <MapPin size={16} />
                    <span>{career.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedCareer && (
            <div className={styles.detailPanel}>
              <h2>{selectedCareer.title}</h2>
              <p className={styles.description}>{selectedCareer.description}</p>

              <div className={styles.skillSection}>
                <h3>
                  <Target size={20} />
                  Skills You Have
                </h3>
                <div className={styles.skillTags}>
                  {selectedCareer.requiredSkills.map((skill, index) => (
                    <span key={index} className={styles.skillTag}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {selectedCareer.missingSkills.length > 0 && (
                <div className={styles.skillSection}>
                  <h3>
                    <Target size={20} />
                    Skills to Learn
                  </h3>
                  <div className={styles.skillTags}>
                    {selectedCareer.missingSkills.map((skill, index) => (
                      <span key={index} className={styles.missingSkillTag}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleCreateLearningPath}
                className={styles.actionButton}
              >
                Create Learning Path
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mock data for development
const mockCareers: Career[] = [
  {
    id: '1',
    title: 'Solar Panel Installer',
    matchScore: 92,
    salary: '$45,000 - $65,000',
    growth: '27%',
    location: 'Nationwide',
    requiredSkills: ['Safety Protocols', 'Hand Tools', 'Physical Stamina'],
    missingSkills: ['Electrical Systems', 'Solar Technology', 'NABCEP Certification'],
    description: 'Install and maintain solar panel systems on rooftops and other structures.',
  },
  {
    id: '2',
    title: 'Wind Turbine Technician',
    matchScore: 88,
    salary: '$52,000 - $75,000',
    growth: '44%',
    location: 'Midwest, Coastal',
    requiredSkills: ['Mechanical Aptitude', 'Safety Standards', 'Problem Solving'],
    missingSkills: ['Hydraulics', 'Electrical Systems', 'GWO Certification'],
    description: 'Maintain and repair wind turbines to ensure optimal energy production.',
  },
  {
    id: '3',
    title: 'HVAC Technician',
    matchScore: 85,
    salary: '$48,000 - $70,000',
    growth: '15%',
    location: 'All regions',
    requiredSkills: ['Equipment Operation', 'Customer Service', 'Troubleshooting'],
    missingSkills: ['EPA Certification', 'Refrigeration', 'Climate Control Systems'],
    description: 'Install and maintain heating, ventilation, and air conditioning systems.',
  },
  {
    id: '4',
    title: 'Heavy Equipment Operator',
    matchScore: 82,
    salary: '$46,000 - $68,000',
    growth: '12%',
    location: 'Construction sites',
    requiredSkills: ['Equipment Operation', 'Safety Awareness', 'Attention to Detail'],
    missingSkills: ['CDL License', 'GPS Systems', 'Site Management Software'],
    description: 'Operate heavy machinery for construction and infrastructure projects.',
  },
];

export default CareerMatch;

