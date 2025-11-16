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
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
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
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'coal_miner' | 'renewable'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filterPrograms = (programs: TrainingProgram[]) => {
    if (!searchTerm) return programs;
    
    const term = searchTerm.toLowerCase();
    return programs.filter(program => 
      program.program_name.toLowerCase().includes(term) ||
      program.provider.toLowerCase().includes(term) ||
      program.description?.toLowerCase().includes(term)
    );
  };

  const getDisplayedPrograms = () => {
    if (!data) return [];
    
    let programs: TrainingProgram[] = [];
    
    if (selectedCategory === 'all') {
      programs = [...data.coal_miner_specific_programs, ...data.general_renewable_programs];
    } else if (selectedCategory === 'coal_miner') {
      programs = data.coal_miner_specific_programs;
    } else {
      programs = data.general_renewable_programs;
    }
    
    return filterPrograms(programs);
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
            <div>
              <h1 className={styles.title}>Renewable Energy Training Programs</h1>
              <p className={styles.subtitle}>
                Programs for coal miners transitioning to clean energy careers in {data?.user_state}
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

        {/* Summary Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <MapPin size={24} />
            </div>
            <div>
              <div className={styles.statValue}>{data?.user_state}</div>
              <div className={styles.statLabel}>Your State</div>
            </div>
          </div>
        </div>

        {/* Message */}
        {data?.message && (
          <div className={styles.messageBox}>
            <CheckCircle2 size={20} />
            <span>{data.message}</span>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filtersSection}>
          <div className={styles.searchBox}>
            <Search size={20} />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.categoryFilters}>
            <button
              className={`${styles.filterButton} ${selectedCategory === 'all' ? styles.active : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              <Filter size={16} />
              All Programs ({data?.total_programs || 0})
            </button>
            <button
              className={`${styles.filterButton} ${selectedCategory === 'coal_miner' ? styles.active : ''}`}
              onClick={() => setSelectedCategory('coal_miner')}
            >
              <Award size={16} />
              Coal Miner Specific ({data?.coal_miner_specific_programs.length || 0})
            </button>
            <button
              className={`${styles.filterButton} ${selectedCategory === 'renewable' ? styles.active : ''}`}
              onClick={() => setSelectedCategory('renewable')}
            >
              <Zap size={16} />
              General Renewable ({data?.general_renewable_programs.length || 0})
            </button>
          </div>
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

