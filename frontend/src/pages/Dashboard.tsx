import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Target, TrendingUp, BookOpen, User, Sparkles, ArrowRight, CheckCircle2, HardHat, Zap, FileText, ChevronLeft, ChevronRight, MapPin, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Logo from '../components/Logo';
import styles from './Dashboard.module.css';
import { Modal, Spin, Alert, Button } from 'antd';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import jsPDF from 'jspdf';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '8px',
};

// Default center (US center)
const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

interface JobCenter {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

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
    state?: string;
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
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantName, setGrantName] = useState<string>('');
  const [grantResult, setGrantResult] = useState<any | null>(null);
  const [grantModalPage, setGrantModalPage] = useState(0); // 0: Eligibility, 1: Documents, 2: Job Centers Map
  
  // Google Maps state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [jobCenters, setJobCenters] = useState<JobCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<JobCenter | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

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

  // Callback when map loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  // Search for nearby American Job Centers
  const searchNearbyJobCenters = useCallback((map: google.maps.Map, location: { lat: number; lng: number }) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      setMapError('Google Maps Places API not loaded');
      return;
    }

    setMapLoading(true);
    setMapError(null);

    const service = new window.google.maps.places.PlacesService(map);
    
    const request: google.maps.places.TextSearchRequest = {
      query: 'American Job Center',
      location: new window.google.maps.LatLng(location.lat, location.lng),
      radius: 80000, // 50 miles in meters
    };

    service.textSearch(request, (results, status) => {
      setMapLoading(false);
      
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const centers: JobCenter[] = results.slice(0, 10).map((place) => ({
          place_id: place.place_id || '',
          name: place.name || 'American Job Center',
          address: place.formatted_address || '',
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        }));
        setJobCenters(centers);
        
        if (centers.length === 0) {
          setMapError('No American Job Centers found nearby. Try a different location.');
        }
      } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        setJobCenters([]);
        setMapError('No American Job Centers found in this area.');
      } else {
        setMapError('Failed to search for job centers. Please try again.');
      }
    });
  }, []);

  // Get user's location when page 3 is shown
  useEffect(() => {
    if (grantModalPage === 2 && isLoaded && !userLocation && !mapLoading) {
      setMapLoading(true);
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(location);
            setMapLoading(false);
            
            // Search for job centers once we have location and map
            if (mapInstance) {
              searchNearbyJobCenters(mapInstance, location);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            // Fall back to default US center
            setUserLocation(defaultCenter);
            setMapLoading(false);
            setMapError('Could not get your location. Showing default map view.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setUserLocation(defaultCenter);
        setMapLoading(false);
        setMapError('Geolocation is not supported by your browser.');
      }
    }
  }, [grantModalPage, isLoaded, userLocation, mapLoading, mapInstance, searchNearbyJobCenters]);

  // Trigger search when map instance is ready and we have location
  useEffect(() => {
    if (mapInstance && userLocation && jobCenters.length === 0 && !mapLoading && grantModalPage === 2) {
      searchNearbyJobCenters(mapInstance, userLocation);
    }
  }, [mapInstance, userLocation, jobCenters.length, mapLoading, grantModalPage, searchNearbyJobCenters]);

  const handleOpenGrant = async (name: string) => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    setGrantName(name);
    setGrantModalOpen(true);
    setGrantLoading(true);
    setGrantError(null);
    setGrantResult(null);
    setGrantModalPage(0); // Reset to first page
    // Reset map state for fresh search
    setJobCenters([]);
    setSelectedCenter(null);
    setUserLocation(null);
    setMapError(null);
    try {
      const resp = await api.post('/subsidy/evaluate', {
        user_id: user.id,
        grant_name: name,
        session_id: 'default',
      });
      const data = resp.data;
      if (data?.status === 'success') {
        setGrantResult(data.data || null);
      } else {
        setGrantError(data?.message || 'Failed to evaluate grant.');
      }
    } catch (e: any) {
      setGrantError(e?.response?.data?.detail || e?.message || 'Request failed');
    } finally {
      setGrantLoading(false);
    }
  };

  // Generate PDF Report
  const generatePDFReport = () => {
    if (!grantResult) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = 20;
    
    // Helper function to add text with word wrap
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 7): number => {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + lines.length * lineHeight;
    };
    
    // Helper to check if we need a new page
    const checkNewPage = (neededSpace: number) => {
      if (yPos + neededSpace > 270) {
        doc.addPage();
        yPos = 20;
      }
    };
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(102, 126, 234); // #667eea
    doc.text('Grant Eligibility Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Grant name
    doc.setFontSize(14);
    doc.setTextColor(55, 65, 81); // #374151
    doc.text(grantName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Eligibility Summary
    const checklist = grantResult.checklist || [];
    const satisfiedCount = checklist.filter((item: any) => item.status === 'satisfied' || item.satisfied === true).length;
    const notSatisfiedCount = checklist.filter((item: any) => item.status === 'not_satisfied' || item.satisfied === false).length;
    const pendingCount = checklist.filter((item: any) => item.status === 'pending').length;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Eligibility Summary', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Eligibility verdict
    if (notSatisfiedCount > 0) {
      doc.setTextColor(220, 38, 38); // red
      yPos = addWrappedText(
        `Based on our analysis, you may NOT be eligible for this grant. ${notSatisfiedCount} requirement(s) are not satisfied.`,
        margin, yPos, contentWidth
      );
    } else if (pendingCount > 0) {
      doc.setTextColor(245, 158, 11); // amber
      yPos = addWrappedText(
        `You appear to be potentially eligible, but ${pendingCount} requirement(s) need verification.`,
        margin, yPos, contentWidth
      );
    } else {
      doc.setTextColor(16, 185, 129); // green
      yPos = addWrappedText(
        'Congratulations! You appear to meet all eligibility requirements for this grant.',
        margin, yPos, contentWidth
      );
    }
    yPos += 5;
    
    // Stats
    doc.setTextColor(107, 114, 128);
    doc.text(`• Satisfied: ${satisfiedCount}  • Not Satisfied: ${notSatisfiedCount}  • Pending Verification: ${pendingCount}`, margin, yPos);
    yPos += 12;
    
    // Eligibility Checklist Section
    checkNewPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Eligibility Checklist', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    checklist.forEach((item: any, index: number) => {
      checkNewPage(20);
      
      const status = item.status || (item.satisfied === true ? 'satisfied' : item.satisfied === false ? 'not_satisfied' : 'pending');
      const statusSymbol = status === 'satisfied' ? '✓' : status === 'not_satisfied' ? '✗' : '?';
      const statusColor = status === 'satisfied' ? [16, 185, 129] : status === 'not_satisfied' ? [220, 38, 38] : [245, 158, 11];
      
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(statusSymbol, margin, yPos);
      
      doc.setTextColor(55, 65, 81);
      yPos = addWrappedText(`${index + 1}. ${item.requirement}`, margin + 8, yPos, contentWidth - 8);
      
      if (item.rationale) {
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        yPos = addWrappedText(`   ${item.rationale}`, margin + 8, yPos, contentWidth - 8, 5);
        doc.setFontSize(10);
      }
      yPos += 3;
    });
    
    yPos += 10;
    
    // Documents Needed Section
    checkNewPage(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Documents Needed', margin, yPos);
    yPos += 8;
    
    const documents = grantResult.documents || [];
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const requiredDocs = documents.filter((d: any) => d.required);
    const optionalDocs = documents.filter((d: any) => !d.required);
    
    if (requiredDocs.length > 0) {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('Required Documents:', margin, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      requiredDocs.forEach((doc_item: any) => {
        checkNewPage(15);
        doc.setTextColor(55, 65, 81);
        yPos = addWrappedText(`• ${doc_item.document_name}`, margin + 5, yPos, contentWidth - 5);
        if (doc_item.description) {
          doc.setTextColor(107, 114, 128);
          doc.setFontSize(9);
          yPos = addWrappedText(`  ${doc_item.description}`, margin + 8, yPos, contentWidth - 10, 5);
          doc.setFontSize(10);
        }
        yPos += 2;
      });
      yPos += 5;
    }
    
    if (optionalDocs.length > 0) {
      checkNewPage(15);
      doc.setTextColor(245, 158, 11);
      doc.setFont('helvetica', 'bold');
      doc.text('Optional Documents:', margin, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      optionalDocs.forEach((doc_item: any) => {
        checkNewPage(15);
        doc.setTextColor(55, 65, 81);
        yPos = addWrappedText(`• ${doc_item.document_name}`, margin + 5, yPos, contentWidth - 5);
        yPos += 2;
      });
    }
    
    yPos += 10;
    
    // Nearby Job Centers Section
    if (jobCenters.length > 0) {
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('Nearby American Job Centers', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Visit these centers for assistance with your grant application:', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      jobCenters.slice(0, 5).forEach((center, index) => {
        checkNewPage(15);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'bold');
        yPos = addWrappedText(`${index + 1}. ${center.name}`, margin, yPos, contentWidth);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        yPos = addWrappedText(`   ${center.address}`, margin, yPos, contentWidth, 5);
        yPos += 4;
      });
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount} | SkillBridge Grant Eligibility Report`,
        pageWidth / 2,
        285,
        { align: 'center' }
      );
    }
    
    // Save the PDF
    const fileName = `${grantName.replace(/[^a-z0-9]/gi, '_')}_Eligibility_Report.pdf`;
    doc.save(fileName);
    toast.success('Report downloaded successfully!');
  };

  const CIRCUMFERENCE = 339.292;
  const progressPercent = skillProfile?.has_assessment ? 100 : 25;
  const progressOffset = CIRCUMFERENCE * (1 - progressPercent / 100);


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
          <Logo variant="icon" onClick={() => navigate('/dashboard')} />
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
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={progressOffset}
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

          <div
            className={`${styles.actionCard} ${styles.quaternary}`}
            onClick={() => navigate('/training')}
          >
            <div className={styles.cardIconWrapper}>
              <Zap size={28} />
            </div>
            <div className={styles.cardContent}>
              <h3>Training Programs</h3>
              <p>Discover training programs for coal miners transitioning to renewable energy careers</p>
              <div className={styles.cardMeta}>
                <CheckCircle2 size={16} />
                <span>Coal miner transition and renewable energy programs</span>
              </div>
            </div>
            <ArrowRight className={styles.cardArrow} size={24} />
          </div>
        </div>

        {/* Available Grants */}
        <div className={styles.sectionHeader}>
          <h2>Available Grants</h2>
          <p>Explore support programs tailored for energy transition</p>
        </div>
        <div className={styles.grantsGrid}>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('POWER Dislocated Worker Grants')}>
            <img src="/grants/power-dwg.png" alt="POWER Dislocated Worker Grants" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>POWER Dislocated Worker Grants</h3>
              <p className={styles.grantSubtitle}>U.S. Department of Labor</p>
            </div>
          </div>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('Assistance to Coal Communities (ACC)')}>
            <img src="/grants/acc-eda.png" alt="Assistance to Coal Communities (ACC)" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>Assistance to Coal Communities (ACC)</h3>
              <p className={styles.grantSubtitle}>Economic Development Administration (EDA)</p>
            </div>
          </div>
          <div className={styles.grantCard} onClick={() => handleOpenGrant('Just Transition Program – Colorado')}>
            <img src="/grants/just-transition-co.png" alt="Just Transition Program – Colorado" className={styles.grantImage} />
            <div className={styles.grantContent}>
              <h3 className={styles.grantTitle}>Just Transition Program – Colorado</h3>
              <p className={styles.grantSubtitle}>Colorado Department of Labor and Employment</p>
            </div>
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
            {(fullProfile?.profile?.previous_job_title || fullProfile?.profile?.mining_type || fullProfile?.profile?.years_mining_experience) && (
              <div className={styles.miningInfoSection}>
                <div className={styles.sectionTitle}>
                  <HardHat size={20} />
                  <h3>Mining Background</h3>
                </div>
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
                onClick={async () => {
                  // Clear previous assessment data when retaking
                  if (skillProfile?.has_assessment) {
                    try {
                      // Call backend to clear assessment data
                      await api.delete('/skills/clear-assessment');
                      toast.info('Previous assessment cleared. Starting new assessment...');
                    } catch (error) {
                      console.error('Error clearing assessment:', error);
                      // Continue to assessment page anyway
                    }
                  }
                  navigate('/assessment');
                }}
              >
                {skillProfile?.has_assessment ? 'Retake Assessment' : 'Start Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Grant Modal */}
      <Modal
        open={grantModalOpen}
        onCancel={() => setGrantModalOpen(false)}
        footer={null}
        title={`Grant Evaluation: ${grantName || ''}`}
        width={720}
      >
        {grantLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spin tip="Evaluating eligibility and documentation requirements..." />
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
              This step might take about 45 seconds to complete.
            </p>
          </div>
        ) : grantError ? (
          <Alert type="error" message={grantError} />
        ) : grantResult ? (
          <div>
            {/* Page Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', gap: '0.5rem' }}>
              {[0, 1, 2].map((page) => (
                <div
                  key={page}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: grantModalPage === page ? '#667eea' : '#e5e7eb',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onClick={() => setGrantModalPage(page)}
                />
              ))}
            </div>

            {/* Page 0: Eligibility Checklist */}
            {grantModalPage === 0 && (
              <div>
                <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={20} style={{ color: '#667eea' }} />
                  Eligibility Checklist
                </h3>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  <span><span style={{ color: '#10b981' }}>✓</span> Satisfied</span>
                  <span><span style={{ color: '#f59e0b' }}>?</span> Needs Verification</span>
                  <span><span style={{ color: '#dc2626' }}>✗</span> Not Satisfied</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {(grantResult.checklist || []).map((item: any, idx: number) => {
                    // Handle both old format (satisfied: bool) and new format (status: string)
                    const status = item.status || (item.satisfied === true ? 'satisfied' : item.satisfied === false ? 'not_satisfied' : 'pending');
                    const statusConfig = {
                      satisfied: { icon: '✓', color: '#10b981', bgColor: '#ecfdf5' },
                      not_satisfied: { icon: '✗', color: '#dc2626', bgColor: '#fef2f2' },
                      pending: { icon: '?', color: '#f59e0b', bgColor: '#fffbeb' }
                    };
                    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
                    
                    return (
                      <li key={idx} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ 
                            color: config.color,
                            backgroundColor: config.bgColor,
                            fontSize: '0.9rem',
                            lineHeight: '1.4',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            minWidth: '1.5rem',
                            textAlign: 'center'
                          }}>
                            {config.icon}
                          </span>
                          <span>{item.requirement}</span>
                        </div>
                        {item.rationale && (
                          <div style={{ color: '#475569', fontSize: '0.9rem', marginLeft: '2.25rem', marginTop: '0.25rem' }}>
                            {item.rationale}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Page 1: Documentation Needed */}
            {grantModalPage === 1 && (
              <div>
                <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: '#667eea' }} />
                  Documentation Needed
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {(grantResult.documents || []).map((doc: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ 
                          color: doc.required ? '#dc2626' : '#f59e0b',
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.375rem',
                          backgroundColor: doc.required ? '#fef2f2' : '#fffbeb',
                          borderRadius: '0.25rem',
                          whiteSpace: 'nowrap'
                        }}>
                          {doc.required ? 'Required' : 'Optional'}
                        </span>
                        <span>{doc.document_name}</span>
                      </div>
                      {doc.description && (
                        <div style={{ color: '#475569', fontSize: '0.9rem', marginLeft: '0rem', marginTop: '0.25rem' }}>
                          {doc.description}
                        </div>
                      )}
                      {doc.how_to_obtain && (
                        <div style={{ color: '#667eea', fontSize: '0.85rem', marginLeft: '0rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          💡 {doc.how_to_obtain}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Page 2: Nearby American Job Centers Map */}
            {grantModalPage === 2 && (
              <div>
                <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={20} style={{ color: '#667eea' }} />
                  Nearby American Job Centers
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  American Job Centers can help you apply for grants and access career services.
                </p>
                
                {loadError && (
                  <Alert type="error" message="Failed to load Google Maps. Please check your API key." style={{ marginBottom: '1rem' }} />
                )}
                
                {!GOOGLE_MAPS_API_KEY && (
                  <Alert type="warning" message="Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file." style={{ marginBottom: '1rem' }} />
                )}
                
                {mapError && (
                  <Alert type="info" message={mapError} style={{ marginBottom: '1rem' }} />
                )}
                
                {mapLoading && !isLoaded && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Spin tip="Loading map..." />
                  </div>
                )}
                
                {isLoaded && GOOGLE_MAPS_API_KEY && (
                  <div style={{ position: 'relative' }}>
                    {mapLoading && (
                      <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        backgroundColor: 'rgba(255,255,255,0.8)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        zIndex: 10,
                        borderRadius: '8px'
                      }}>
                        <Spin tip="Finding nearby job centers..." />
                      </div>
                    )}
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={userLocation || defaultCenter}
                      zoom={userLocation ? 10 : 4}
                      onLoad={onMapLoad}
                      options={{
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: true,
                      }}
                    >
                      {/* User location marker */}
                      {userLocation && (
                        <Marker
                          position={userLocation}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#667eea',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                          }}
                          title="Your Location"
                        />
                      )}
                      
                      {/* Job Center markers */}
                      {jobCenters.map((center) => (
                        <Marker
                          key={center.place_id}
                          position={{ lat: center.lat, lng: center.lng }}
                          onClick={() => setSelectedCenter(center)}
                          icon={{
                            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                          }}
                        />
                      ))}
                      
                      {/* Info window for selected center */}
                      {selectedCenter && (
                        <InfoWindow
                          position={{ lat: selectedCenter.lat, lng: selectedCenter.lng }}
                          onCloseClick={() => setSelectedCenter(null)}
                        >
                          <div style={{ maxWidth: '200px' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                              {selectedCenter.name}
                            </h4>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                              {selectedCenter.address}
                            </p>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedCenter.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#667eea', fontSize: '0.85rem', textDecoration: 'none' }}
                            >
                              Get Directions →
                            </a>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                )}
                
                {/* List of job centers */}
                {jobCenters.length > 0 && (
                  <div style={{ marginTop: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.5rem' }}>
                      {jobCenters.length} Job Center{jobCenters.length !== 1 ? 's' : ''} Found:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                      {jobCenters.map((center) => (
                        <li 
                          key={center.place_id} 
                          style={{ 
                            marginBottom: '0.5rem', 
                            cursor: 'pointer',
                            color: selectedCenter?.place_id === center.place_id ? '#667eea' : '#4b5563'
                          }}
                          onClick={() => {
                            setSelectedCenter(center);
                            if (mapInstance) {
                              mapInstance.panTo({ lat: center.lat, lng: center.lng });
                              mapInstance.setZoom(14);
                            }
                          }}
                        >
                          <strong>{center.name}</strong>
                          <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{center.address}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <Button
                type="default"
                icon={<ChevronLeft size={16} />}
                onClick={() => setGrantModalPage((prev) => Math.max(0, prev - 1))}
                disabled={grantModalPage === 0}
              >
                Previous
              </Button>
              
              {grantModalPage === 2 ? (
                <Button
                  type="primary"
                  onClick={generatePDFReport}
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                  icon={<Download size={16} />}
                >
                  Generate Report
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={() => setGrantModalPage((prev) => Math.min(2, prev + 1))}
                  style={{ backgroundColor: '#667eea', borderColor: '#667eea' }}
                >
                  Next <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Alert type="info" message="No result returned." />
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
