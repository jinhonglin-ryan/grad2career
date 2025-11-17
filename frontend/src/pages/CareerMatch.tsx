import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, TrendingUp, DollarSign, MapPin, Target, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from '../components/Logo';
import styles from './CareerMatch.module.css';

interface Career {
  id: string;
  career_title: string;
  match_score: number;
  salary_range: string;
  growth_rate: string;
  local_demand_rating?: string;
  commute_distance_miles?: number;
  commute_time_minutes?: number;
  local_job_growth?: string;
  transferable_skills: string[];
  matching_required_skills: string[];
  missing_skills: string[];
  description: string;
  category?: string;
  appalachian_states?: string[];
  required_certifications?: string[];
  entry_level_education?: string;
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
      if (response.data && response.data.careers) {
        // Transform API response to match component expectations
        const transformedCareers = response.data.careers.map((career: any) => ({
          ...career,
          // Keep all fields from API, they're already in the right format
        }));
        
        // Ensure Solar Panel Installation is always first
        const solarCareer = solarPanelInstallationCareer;
        const otherCareers = transformedCareers.filter(
          (c: Career) => !c.career_title.toLowerCase().includes('solar panel installation')
        );
        setCareers([solarCareer, ...otherCareers]);
      } else {
        setCareers([solarPanelInstallationCareer]);
      }
    } catch (error: any) {
      console.error('Error fetching careers:', error);
      if (error.response?.status === 404) {
        // User hasn't completed assessment yet - still show Solar Panel Installation
        setCareers([solarPanelInstallationCareer]);
      } else {
        // Use mock data for development/fallback
        setCareers(mockCareers);
      }
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
          <h1>Your Career Matches</h1>
          <p>Based on your mining experience, here are careers that fit your profile</p>
          {careers.length === 0 && !loading && (
            <p style={{ color: '#ef4444', marginTop: '1rem' }}>
              No career matches found. Please complete the skill assessment first.
            </p>
          )}
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
                  <h3>{career.career_title}</h3>
                  <div className={styles.matchScore}>
                    {career.match_score}% Match
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.infoItem}>
                    <DollarSign size={16} />
                    <span>{career.salary_range || 'Salary varies'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <TrendingUp size={16} />
                    <span>{career.growth_rate || 'Growing field'}</span>
                  </div>
                  {career.local_demand_rating && (
                    <div className={styles.infoItem}>
                      <MapPin size={16} />
                      <span>Demand: {career.local_demand_rating}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedCareer && (
            <div className={styles.detailPanel}>
              <h2>{selectedCareer.career_title}</h2>
              <p className={styles.description}>{selectedCareer.description || 'A great career transition opportunity for coal miners.'}</p>

              {selectedCareer.transferable_skills && selectedCareer.transferable_skills.length > 0 && (
                <div className={styles.skillSection}>
                  <h3>
                    <Target size={20} />
                    Your Transferable Mining Skills
                  </h3>
                  <div className={styles.skillTags}>
                    {selectedCareer.transferable_skills.map((skill, index) => (
                      <span key={index} className={styles.skillTag}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCareer.matching_required_skills && selectedCareer.matching_required_skills.length > 0 && (
                <div className={styles.skillSection}>
                  <h3>
                    <Target size={20} />
                    Skills You Have
                  </h3>
                  <div className={styles.skillTags}>
                    {selectedCareer.matching_required_skills.map((skill, index) => (
                      <span key={index} className={styles.skillTag}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCareer.missing_skills && selectedCareer.missing_skills.length > 0 && (
                <div className={styles.skillSection}>
                  <h3>
                    <Target size={20} />
                    Skills to Learn
                  </h3>
                  <div className={styles.skillTags}>
                    {selectedCareer.missing_skills.map((skill, index) => (
                      <span key={index} className={styles.missingSkillTag}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCareer.required_certifications && selectedCareer.required_certifications.length > 0 && (
                <div className={styles.skillSection}>
                  <h3>
                    <Target size={20} />
                    Required Certifications
                  </h3>
                  <div className={styles.skillTags}>
                    {selectedCareer.required_certifications.map((cert, index) => (
                      <span key={index} className={styles.certTag}>
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCareer.local_job_growth && (
                <div className={styles.skillSection}>
                  <p className={styles.localGrowth}>{selectedCareer.local_job_growth}</p>
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

// Featured career - always shown first
const solarPanelInstallationCareer: Career = {
  id: 'solar-panel-installation-featured',
  career_title: 'Solar Panel Installation',
  match_score: 95,
  salary_range: '$45,000 - $70,000',
  growth_rate: 'Much faster than average (52% growth)',
  local_demand_rating: 'Very High',
  commute_distance_miles: 15,
  commute_time_minutes: 25,
  local_job_growth: '🌟 Rapidly growing field with high demand in Appalachian regions. Federal and state incentives are driving massive solar expansion.',
  transferable_skills: [
    'Electrical work',
    'Safety training',
    'Tool proficiency',
    'Working at heights',
    'Physical stamina',
    'Blueprint reading'
  ],
  matching_required_skills: [
    'Safety Protocols',
    'Hand Tools',
    'Physical Stamina',
    'Electrical Basics',
    'Problem Solving'
  ],
  missing_skills: [
    'Photovoltaic (PV) Systems',
    'Solar Array Design',
    'NABCEP Certification',
    'Electrical Code (NEC)',
    'Racking Systems',
    'Inverter Installation'
  ],
  description: 'Solar Panel Installation professionals install, maintain, and repair solar photovoltaic (PV) systems on residential, commercial, and industrial buildings. This fast-growing career combines electrical work with renewable energy technology. Coal miners transitioning to this field find their experience with electrical systems, safety protocols, and working in challenging conditions highly valuable. The industry offers excellent job security, competitive wages, and the opportunity to be part of the clean energy transition.',
  category: 'Renewable Energy',
  appalachian_states: ['West Virginia', 'Kentucky', 'Pennsylvania', 'Virginia', 'Ohio'],
  required_certifications: [
    'NABCEP PV Installation Professional',
    'OSHA 30-Hour Construction',
    'Fall Protection Certification',
    'Electrical License (varies by state)'
  ],
  entry_level_education: 'High school diploma or equivalent, technical training recommended'
};

// Mock data for development (fallback)
const mockCareers: Career[] = [
  solarPanelInstallationCareer,
  {
    id: '1',
    career_title: 'Solar Panel Installer',
    match_score: 92,
    salary_range: '$45,000 - $65,000',
    growth_rate: 'Much faster than average (52% growth)',
    local_demand_rating: 'high',
    transferable_skills: ['Electrical work', 'Safety training', 'Tool proficiency'],
    matching_required_skills: ['Safety Protocols', 'Hand Tools', 'Physical Stamina'],
    missing_skills: ['Electrical Systems', 'Solar Technology', 'NABCEP Certification'],
    description: 'Install and maintain solar panel systems on rooftops and other structures.',
  },
  {
    id: '2',
    career_title: 'Wind Turbine Technician',
    match_score: 88,
    salary_range: '$45,000 - $70,000',
    growth_rate: 'Much faster than average (68% growth)',
    local_demand_rating: 'high',
    transferable_skills: ['Heavy machinery operation', 'Electrical maintenance', 'Safety training'],
    matching_required_skills: ['Mechanical Aptitude', 'Safety Standards', 'Problem Solving'],
    missing_skills: ['Hydraulics', 'Electrical Systems', 'GWO Certification'],
    description: 'Maintain and repair wind turbines to ensure optimal energy production.',
  },
];

export default CareerMatch;

