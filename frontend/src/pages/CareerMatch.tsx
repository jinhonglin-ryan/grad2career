import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, TrendingUp, DollarSign, MapPin, Target, ArrowLeft, Loader2 } from 'lucide-react';
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
  const [creatingPath, setCreatingPath] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCareerMatches();
  }, []);

  const fetchCareerMatches = async () => {
    try {
      const response = await api.get('/careers/match');
      if (response.data && response.data.careers) {
        // Sort careers by match score (highest first)
        const sortedCareers = response.data.careers.sort((a: Career, b: Career) => 
          b.match_score - a.match_score
        );
        setCareers(sortedCareers);
      } else {
        setCareers([]);
      }
    } catch (error: any) {
      console.error('Error fetching careers:', error);
      if (error.response?.status === 404) {
        // User hasn't completed assessment yet
        setCareers([]);
      } else {
        // Show error message
        setCareers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCareer = (career: Career) => {
    setSelectedCareer(career);
  };

  const handleCreateLearningPath = async () => {
    if (!selectedCareer) return;
    
    setCreatingPath(true);
    try {
      // Create learning path entry with the selected career
      const response = await api.post('/learning/learning-paths', {
        career_title: selectedCareer.career_title,
        career_id: selectedCareer.id,
        scheduled_videos: [], // Empty initially, will be populated via chat
      });
      
      if (response.data?.success && response.data?.data) {
        const learningPath = response.data.data;
        // Navigate to learning page with the learning path data
        navigate('/learning', { 
          state: { 
            career: selectedCareer,
            learningPathId: learningPath.id,
          } 
        });
      } else {
        // Fallback: navigate anyway
        navigate('/learning', { state: { career: selectedCareer } });
      }
    } catch (error) {
      console.error('Error creating learning path:', error);
      // Still navigate even if creation fails - LearningPath can handle it
      navigate('/learning', { state: { career: selectedCareer } });
    } finally {
      setCreatingPath(false);
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
                disabled={creatingPath}
              >
                {creatingPath ? (
                  <>
                    <Loader2 size={18} className={styles.spinning} />
                    Creating...
                  </>
                ) : (
                  'Create Learning Path'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CareerMatch;

