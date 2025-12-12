import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  LogOut, 
  Zap, 
  Award, 
  MapPin, 
  Clock, 
  DollarSign, 
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Map as MapIcon,
  List,
  Target
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from '../components/Logo';
import TrainingProgramMap from '../components/TrainingProgramMap';
import styles from './TrainingPrograms.module.css';

interface TrainingProgram {
  program_name: string;
  provider: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  duration?: string;
  cost?: string;
  description?: string;
  url?: string;
  is_coal_miner_specific: boolean;
  is_career_specific?: boolean;
  match_score: number;
  relevance_reason?: string;
  contact_info?: string;
  schedule_type?: string;
  
  // Enhanced presentation fields
  recommendation_level?: 'highly_recommended' | 'recommended' | 'alternative';
  why_recommended?: string;
  key_highlights?: string[];
  next_steps?: string;
  estimated_commitment?: string;
}

interface CareerSearchResponse {
  success: boolean;
  career_title: string;
  state?: string;  // From agent
  user_state?: string;  // From old endpoint
  career_specific_programs: TrainingProgram[];
  general_programs: TrainingProgram[];
  used_fallback: boolean;
  total_programs: number;
  user_constraints: Record<string, any>;
  message: string;
  
  // Enhanced presentation data
  highly_recommended?: TrainingProgram[];
  recommended?: TrainingProgram[];
  alternatives?: TrainingProgram[];
  executive_summary?: string;
  personalized_recommendation?: string;
}

const CACHE_KEY_PREFIX = 'training_programs_cache_';
const CACHE_KEY_LAST_SEARCH = 'training_programs_last_search';
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

interface CachedSearchResult {
  data: CareerSearchResponse;
  timestamp: number;
  careerTitle: string;
}

interface CareerMatch {
  id: string;
  career_title: string;
  match_score: number;
  salary_range: string;
  growth_rate: string;
  transferable_skills: string[];
}

const TrainingPrograms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CareerSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [careerTitle, setCareerTitle] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [careerMatches, setCareerMatches] = useState<CareerMatch[]>([]);
  const [loadingCareers, setLoadingCareers] = useState(true);
  const [targetCareer, setTargetCareer] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Helper functions for localStorage (defined before useEffect)
  const getCacheKey = (title: string) => {
    return `${CACHE_KEY_PREFIX}${title.toLowerCase().replace(/\s+/g, '_')}`;
  };

  const loadFromCache = (title: string): CachedSearchResult | null => {
    try {
      const cacheKey = getCacheKey(title);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedSearchResult = JSON.parse(cached);
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

      // Check if cache is still valid
      if (now - parsed.timestamp < expiryTime) {
        return parsed;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  const saveToCache = (title: string, searchData: CareerSearchResponse) => {
    try {
      const cacheKey = getCacheKey(title);
      const cacheData: CachedSearchResult = {
        data: searchData,
        timestamp: Date.now(),
        careerTitle: title
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      // Save as last search
      localStorage.setItem(CACHE_KEY_LAST_SEARCH, title);
    } catch (error) {
      // Silently fail if localStorage is full or disabled
    }
  };

  const handleSearch = async (searchCareerTitle?: string, forceRefresh: boolean = false) => {
    const titleToSearch = searchCareerTitle || careerTitle;
    
    if (!titleToSearch.trim()) {
      setError('Please enter a career title to search');
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = loadFromCache(titleToSearch);
      if (cached) {
        setData(cached.data);
        setError(null);
        
        // Scroll to results even when loading from cache
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 100);
        
        return;
      }
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    
    // Simulate agent thinking steps
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < 4) return prev + 1;
        return prev;
      });
    }, 1200); // Change step every 1.2 seconds
    
    try {
      const response = await api.post('/training/career-specific-search', {
        career_title: titleToSearch,
        max_results: 20
      });
      
      clearInterval(stepInterval);
      setLoadingStep(5); // Final step
      
      // Show final step briefly before displaying results
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setData(response.data);
      
      // Save to cache
      saveToCache(titleToSearch, response.data);
      
      // Scroll to results after a brief delay to ensure DOM is updated
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Error fetching training programs:', err);
      setError(err.response?.data?.detail || 'Failed to fetch training programs. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleQuickSearch = (career: CareerMatch) => {
    setCareerTitle(career.career_title);
    handleSearch(career.career_title);
  };

  // Fetch career matches on mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchCareerMatches = async () => {
      try {
        const response = await api.get('/careers/match');
        if (isMounted && response.data && response.data.careers) {
          const sortedCareers = response.data.careers
            .sort((a: CareerMatch, b: CareerMatch) => b.match_score - a.match_score)
            .slice(0, 6); // Show top 6 careers
          setCareerMatches(sortedCareers);
          
          // Set target career as the top match
          if (sortedCareers.length > 0) {
            setTargetCareer(sortedCareers[0].career_title);
          }
        }
      } catch (error) {
        console.error('Error fetching career matches:', error);
      } finally {
        if (isMounted) {
          setLoadingCareers(false);
        }
      }
    };
    
    fetchCareerMatches();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load last search or handle navigation on mount
  useEffect(() => {
    const stateCareer = location.state?.career;
    
    if (stateCareer) {
      // Coming from Career Match page - prioritize this
      setCareerTitle(stateCareer.career_title);
      const cached = loadFromCache(stateCareer.career_title);
      if (cached) {
        setData(cached.data);
      } else {
        handleSearch(stateCareer.career_title);
      }
    } else {
      // Load last search automatically on mount
      const lastSearchTitle = localStorage.getItem(CACHE_KEY_LAST_SEARCH);
      if (lastSearchTitle) {
        const cached = loadFromCache(lastSearchTitle);
        if (cached) {
          setCareerTitle(lastSearchTitle);
          setData(cached.data);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDisplayedPrograms = (): TrainingProgram[] => {
    if (!data) return [];
    
    // Prefer categorized programs if available
    if (data.highly_recommended || data.recommended || data.alternatives) {
      return [
        ...(data.highly_recommended || []),
        ...(data.recommended || []),
        ...(data.alternatives || [])
      ];
    }
    
    // Fallback to old format
    return [...data.career_specific_programs, ...data.general_programs];
  };
  
  const getRecommendationBadgeStyle = (level?: string) => {
    switch (level) {
      case 'highly_recommended':
        return styles.highlyRecommendedBadge;
      case 'recommended':
        return styles.recommendedBadge;
      case 'alternative':
        return styles.alternativeBadge;
      default:
        return '';
    }
  };
  
  const getRecommendationLabel = (level?: string) => {
    switch (level) {
      case 'highly_recommended':
        return '🌟 Highly Recommended';
      case 'recommended':
        return '⭐ Recommended';
      case 'alternative':
        return '✓ Alternative';
      default:
        return '';
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return styles.scoreHigh;
    if (score >= 60) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getLoadingStepText = (step: number) => {
    const steps = [
      { icon: '🤔', text: 'Analyzing your career requirements...', subtext: 'Understanding what skills and training you need' },
      { icon: '🔍', text: 'Searching training databases...', subtext: 'Querying thousands of programs across the region' },
      { icon: '📊', text: 'Evaluating program relevance...', subtext: 'Matching programs to your specific career path' },
      { icon: '⚖️', text: 'Ranking by match quality...', subtext: 'Prioritizing best-fit options for your situation' },
      { icon: '✨', text: 'Preparing personalized recommendations...', subtext: 'Organizing results based on your constraints' },
      { icon: '✅', text: 'Complete!', subtext: 'Loading your training programs...' }
    ];
    return steps[step] || steps[0];
  };

  const renderMap = () => {
    try {
      const programs = getDisplayedPrograms();
      return <TrainingProgramMap programs={programs} userState={data?.state || data?.user_state} />;
    } catch (error) {
      console.error('Map render error:', error);
      return (
        <div className={styles.errorBanner}>
          <AlertCircle size={20} />
          <span>Unable to load map. Please refresh the page.</span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <nav className={styles.nav}>
          <div className={styles.navContent}>
            <Logo variant="icon" onClick={() => navigate('/dashboard')} />
            <div className={styles.navRight}>
              <button onClick={() => navigate('/dashboard')} className={styles.backButton}>
                <ArrowLeft size={18} />
                Back
              </button>
              <button onClick={logout} className={styles.logoutButton}>
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </nav>
        
        <div className={styles.loadingContainer}>
          <div className={styles.agentThinking}>
            <Loader2 size={48} className={styles.spinner} />
            <div className={styles.thinkingSteps}>
              {[0, 1, 2, 3, 4, 5].map((step) => {
                const stepInfo = getLoadingStepText(step);
                const isActive = step === loadingStep;
                const isCompleted = step < loadingStep;
                
                return (
                  <div 
                    key={step} 
                    className={`${styles.thinkingStep} ${isActive ? styles.activeStep : ''} ${isCompleted ? styles.completedStep : ''}`}
                  >
                    <div className={styles.stepIcon}>
                      {isCompleted ? '✓' : stepInfo.icon}
                    </div>
                    <div className={styles.stepContent}>
                      <div className={styles.stepText}>{stepInfo.text}</div>
                      {isActive && <div className={styles.stepSubtext}>{stepInfo.subtext}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayedPrograms = getDisplayedPrograms();

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Logo variant="icon" onClick={() => navigate('/dashboard')} />
          <div className={styles.navRight}>
            <button onClick={() => navigate('/dashboard')} className={styles.backButton}>
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <button onClick={logout} className={styles.logoutButton}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className={styles.mainContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>
              <Zap size={32} />
            </div>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Career Training Programs</h1>
              <p className={styles.subtitle}>
                Click on a career below to find tailored training programs
              </p>
            </div>
          </div>
        </div>

        {/* Career Match Cards */}
        {!loadingCareers && careerMatches.length > 0 && (
          <div className={styles.quickSearchSection}>
            <h3 className={styles.quickSearchTitle}>Your Career Matches - Click to Search Programs</h3>
            <div className={styles.careerCardsGrid}>
              {careerMatches.map((career) => {
                const isTargetCareer = career.career_title === targetCareer;
                return (
                  <div
                    key={career.id}
                    className={`${styles.careerQuickCard} ${isTargetCareer ? styles.targetCareerCard : ''}`}
                    onClick={() => handleQuickSearch(career)}
                  >
                    {isTargetCareer && (
                      <div className={styles.targetBadge}>
                        <Target size={14} />
                        Top Match
                      </div>
                    )}
                    <div className={styles.careerCardHeader}>
                      <h4>{career.career_title}</h4>
                      <span className={styles.quickMatchScore}>{career.match_score}%</span>
                    </div>
                    <div className={styles.careerCardInfo}>
                      <span className={styles.careerSalary}>
                        <DollarSign size={14} />
                        {career.salary_range}
                      </span>
                    </div>
                    {career.transferable_skills && career.transferable_skills.length > 0 && (
                      <div className={styles.careerSkills}>
                        {career.transferable_skills.slice(0, 2).map((skill, idx) => (
                          <span key={idx} className={styles.skillPill}>{skill}</span>
                        ))}
                        {career.transferable_skills.length > 2 && (
                          <span className={styles.moreSkills}>+{career.transferable_skills.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Results Header */}
            <div ref={resultsRef} className={styles.resultsHeader}>
              <div className={styles.resultsInfo}>
                {(data.state || data.user_state) && (
                  <div className={styles.stateBadge}>
                    <MapPin size={16} />
                    {data.state || data.user_state}
                  </div>
                )}
                <h2>{data.career_title} Training Programs</h2>
              </div>
              <div className={styles.viewToggle}>
                <button
                  className={viewMode === 'list' ? styles.active : ''}
                  onClick={() => setViewMode('list')}
                >
                  <List size={18} />
                  List
                </button>
                <button
                  className={viewMode === 'map' ? styles.active : ''}
                  onClick={() => setViewMode('map')}
                >
                  <MapIcon size={18} />
                  Map
                </button>
              </div>
            </div>

            {/* Executive Summary and Personalized Recommendation */}
            {(data.executive_summary || data.personalized_recommendation) && (
              <div className={styles.guidanceSection}>
                {data.executive_summary && (
                  <div className={styles.executiveSummary}>
                    <h3>📊 Overview</h3>
                    <p>{data.executive_summary}</p>
                  </div>
                )}
                {data.personalized_recommendation && (
                  <div className={styles.personalizedRecommendation}>
                    <h3>💡 Personalized Recommendation</h3>
                    <p>{data.personalized_recommendation}</p>
                  </div>
                )}
              </div>
            )}


            {/* List or Map View */}
            {viewMode === 'list' ? (
              <div className={styles.programsList}>
                {displayedPrograms.length === 0 ? (
                  <div className={styles.emptyState}>
                    <AlertCircle size={48} />
                    <h3>No programs found</h3>
                    <p>Try a different career title or check back later</p>
                  </div>
                ) : (
                  displayedPrograms.map((program, index) => (
                    <div key={index} className={styles.programCard}>
                      <div className={styles.programHeader}>
                        <div className={styles.programTitle}>
                          <h3>{program.program_name}</h3>
                          <div className={styles.badges}>
                            {program.recommendation_level && (
                              <span className={getRecommendationBadgeStyle(program.recommendation_level)}>
                                {getRecommendationLabel(program.recommendation_level)}
                              </span>
                            )}
                            {program.is_career_specific && (
                              <span className={styles.careerSpecificBadge}>
                                <Award size={14} />
                                Career-Specific
                              </span>
                            )}
                            {program.is_coal_miner_specific && (
                              <span className={styles.specialBadge}>
                                <Award size={14} />
                                Coal Miner Program
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`${styles.matchScore} ${getMatchScoreColor(program.match_score)}`}>
                          {Math.round(program.match_score)}% Match
                        </div>
                      </div>

                      <div className={styles.programProvider}>
                        {program.provider}
                      </div>

                      {/* Why Recommended */}
                      {program.why_recommended && (
                        <div className={styles.whyRecommended}>
                          <CheckCircle2 size={16} />
                          <span>{program.why_recommended}</span>
                        </div>
                      )}

                      {/* Key Highlights */}
                      {program.key_highlights && program.key_highlights.length > 0 && (
                        <div className={styles.keyHighlights}>
                          <h4>✨ Key Highlights:</h4>
                          <ul>
                            {program.key_highlights.map((highlight, idx) => (
                              <li key={idx}>{highlight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {program.description && (
                        <p className={styles.programDescription}>
                          {program.description}
                        </p>
                      )}

                      <div className={styles.programDetails}>
                        {program.location && (
                          <div className={styles.detail}>
                            <MapPin size={16} />
                            <span>{program.location}</span>
                          </div>
                        )}
                        {program.duration && (
                          <div className={styles.detail}>
                            <Clock size={16} />
                            <span>{program.duration}</span>
                          </div>
                        )}
                        {program.cost && (
                          <div className={styles.detail}>
                            <DollarSign size={16} />
                            <span>{program.cost}</span>
                          </div>
                        )}
                        {program.estimated_commitment && (
                          <div className={styles.detail}>
                            <Clock size={16} />
                            <span>Time: {program.estimated_commitment}</span>
                          </div>
                        )}
                        {program.schedule_type && (
                          <div className={styles.detail}>
                            <Clock size={16} />
                            <span>Schedule: {program.schedule_type}</span>
                          </div>
                        )}
                        {program.contact_info && (
                          <div className={styles.detail}>
                            <span>📞 {program.contact_info}</span>
                          </div>
                        )}
                      </div>

                      {/* Next Steps */}
                      {program.next_steps && (
                        <div className={styles.nextSteps}>
                          <h4>🎯 Next Steps:</h4>
                          <p>{program.next_steps}</p>
                        </div>
                      )}

                      {program.url && (
                        <a
                          href={program.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.learnMoreButton}
                        >
                          Learn More & Apply
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              renderMap()
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrainingPrograms;
