import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from '../components/Logo';
import styles from './TrainingPrograms.module.css';

interface TrainingProgram {
  program_name: string;
  provider: string;
  location?: string;
  duration?: string;
  cost?: string;
  description?: string;
  url?: string;
  is_coal_miner_specific: boolean;
  match_score: number;
  relevance_reason?: string;
}

interface TrainingRecommendationResponse {
  success: boolean;
  user_state: string;
  coal_miner_specific_programs: TrainingProgram[];
  general_renewable_programs: TrainingProgram[];
  total_programs: number;
  search_details: {
    queries_used: string[];
    state: string;
    zip_code: string;
    total_raw_results: number;
    unique_programs: number;
  };
  message: string;
}

const TrainingPrograms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<TrainingRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrainingPrograms();
  }, []);

  const fetchTrainingPrograms = async (forceLiveSearch: boolean = false) => {
    if (forceLiveSearch) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const endpoint = forceLiveSearch 
        ? '/training/search-live-programs'  // Force live search
        : '/training/coal-miner-training';   // Use cache if available
      
      const response = await api.post(endpoint, {
        max_results: 20
      });
      
      setData(response.data);
    } catch (err: any) {
      console.error('Error fetching training programs:', err);
      setError(err.response?.data?.detail || 'Failed to fetch training programs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDisplayedPrograms = () => {
    if (!data) return [];
    // Show all programs (no filtering)
    return [...data.coal_miner_specific_programs, ...data.general_renewable_programs];
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return styles.scoreHigh;
    if (score >= 60) return styles.scoreMedium;
    return styles.scoreLow;
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
          <Loader2 size={48} className={styles.spinner} />
          <h2>Loading training programs...</h2>
          <p>Checking for cached results or performing live search if needed</p>
        </div>
      </div>
    );
  }

  if (error) {
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
        
        <div className={styles.errorContainer}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Unable to Load Training Programs</h2>
          <p>{error}</p>
          <button onClick={fetchTrainingPrograms} className={styles.retryButton}>
            Try Again
          </button>
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
              <div className={styles.stateBadge}>
                <MapPin size={16} />
                {data?.user_state || 'Loading...'}
              </div>
              <h1 className={styles.title}>Renewable Energy Training Programs</h1>
              <p className={styles.subtitle}>
                Programs for coal miners transitioning to clean energy careers
              </p>
            </div>
          </div>
          <button 
            className={styles.refreshButton}
            onClick={() => fetchTrainingPrograms(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={18} className={refreshing ? styles.spinning : ''} />
            {refreshing ? 'Searching...' : 'Refresh Results'}
          </button>
        </div>

        {/* Programs List */}
        <div className={styles.programsList}>
          {displayedPrograms.length === 0 ? (
            <div className={styles.emptyState}>
              <AlertCircle size={48} />
              <h3>No programs found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          ) : (
            displayedPrograms.map((program, index) => (
              <div key={index} className={styles.programCard}>
                <div className={styles.programHeader}>
                  <div className={styles.programTitle}>
                    <h3>{program.program_name}</h3>
                    {program.is_coal_miner_specific && (
                      <span className={styles.specialBadge}>
                        <Award size={14} />
                        Coal Miner Program
                      </span>
                    )}
                  </div>
                  <div className={`${styles.matchScore} ${getMatchScoreColor(program.match_score)}`}>
                    {Math.round(program.match_score)}% Match
                  </div>
                </div>

                <div className={styles.programProvider}>
                  {program.provider}
                </div>

                {program.relevance_reason && (
                  <div className={styles.relevanceReason}>
                    <CheckCircle2 size={14} />
                    {program.relevance_reason}
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
                </div>

                {program.url && (
                  <a
                    href={program.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.learnMoreButton}
                  >
                    Learn More
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingPrograms;

