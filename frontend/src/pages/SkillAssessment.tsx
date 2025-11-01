import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Briefcase, LogOut, CheckCircle, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './SkillAssessment.module.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ExtractedSkill {
  category: string;
  user_phrase: string;
  onet_task_codes: string[];
}

interface SkillProfile {
  user_id: string;
  raw_job_title: string;
  raw_experience_summary: string;
  extraction_timestamp: string;
  extracted_skills: ExtractedSkill[];
}

const TURN_LABELS_FULL = {
  1: 'Professional Identity & Scope',
  2: 'Mechanical & Hydraulic',
  3: 'Electrical & Diagnostics',
  4: 'Safety, Leadership, & Compliance'
};

const SkillAssessment = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [skillProfile, setSkillProfile] = useState<SkillProfile | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Ensure layout is calculated correctly on mount/navigation
  useLayoutEffect(() => {
    // Force layout recalculation
    setIsMounted(true);
    
    // Scroll to top after a small delay to ensure nav is rendered
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for existing skills on mount
  useEffect(() => {
    const loadExistingSkills = async () => {
      if (!user?.id) return;
      
      try {
        const response = await api.get(`/skills/profile/${user.id}`);
        if (response.data.has_assessment && response.data.extracted_skills && response.data.extracted_skills.length > 0) {
          setSkillProfile({
            user_id: user.id,
            raw_job_title: response.data.user_profile?.work_experience?.split('.')[0] || 
                          response.data.extracted_skills[0]?.category || 
                          'Previous Assessment',
            raw_experience_summary: response.data.user_profile?.work_experience || '',
            extraction_timestamp: response.data.updated_at || new Date().toISOString(),
            extracted_skills: response.data.extracted_skills
          });
          // Show existing skills but don't start conversation automatically
          // User can click "Redo Assessment" to start a new one
        }
      } catch (error) {
        console.error('Error loading existing skills:', error);
        // If no existing skills, continue to start new assessment
      }
    };

    loadExistingSkills();
  }, [user?.id]);

  // Initialize assessment on mount (only if no existing skills shown)
  useEffect(() => {
    const startAssessment = async () => {
      // Don't start if we're showing existing skills (wait for user to click "Redo Assessment")
      if (skillProfile && !sessionId) return;
      
      try {
        setInitializing(true);
        const response = await api.post('/skills/assess/start', {
          user_id: user?.id || 'web'
        });
        
        const initialMessage: Message = {
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
        };
        
        setMessages([initialMessage]);
        setCurrentTurn(response.data.current_turn);
        setSessionId(response.data.session_id);
      } catch (error) {
        console.error('Error starting assessment:', error);
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered an error starting the assessment. Please refresh the page and try again.',
          timestamp: new Date(),
        };
        setMessages([errorMessage]);
      } finally {
        setInitializing(false);
      }
    };

    // Only auto-start if no session ID and we don't have existing skills being displayed
    if (!sessionId && !skillProfile) {
      startAssessment();
    }
  }, [user?.id, skillProfile, sessionId]);

  const handleSend = async () => {
    if (!input.trim() || loading || !sessionId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/skills/assess/conversation', {
        message: input,
        session_id: sessionId,
        user_id: user?.id || 'web'
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentTurn(response.data.current_turn);

      // Update skill profile in real-time if partial data is available
      if (response.data.skill_profile && response.data.skill_profile.extracted_skills) {
        setSkillProfile(response.data.skill_profile);
      }

      // If assessment is complete, show validation
      if (response.data.is_complete && response.data.skill_profile) {
        setSkillProfile(response.data.skill_profile);
        setShowValidation(true);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error.response?.data?.detail || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmProfile = () => {
    // Navigate to career matching with skill profile
    navigate('/careers', { state: { skillProfile } });
  };

  const handleEditProfile = () => {
    setShowValidation(false);
    // Allow user to continue conversation if needed
  };

  const handleComplete = () => {
    if (skillProfile) {
      navigate('/careers', { state: { skillProfile } });
    } else {
      navigate('/careers');
    }
  };

  const handleRedoAssessment = async () => {
    // Reset state for new assessment
    setSkillProfile(null);
    setMessages([]);
    setCurrentTurn(1);
    setSessionId(null);
    setShowValidation(false);
    
    // Start new assessment
    try {
      setInitializing(true);
      const response = await api.post('/skills/assess/start', {
        user_id: user?.id || 'web'
      });
      
      const initialMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };
      
      setMessages([initialMessage]);
      setCurrentTurn(response.data.current_turn);
      setSessionId(response.data.session_id);
    } catch (error) {
      console.error('Error starting assessment:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error starting the assessment. Please try again.',
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    } finally {
      setInitializing(false);
    }
  };

  const isComplete = currentTurn >= 4 && skillProfile !== null;

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => navigate('/')}>
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
        {/* Chat and Sidebar Grid */}
        <div className={styles.contentGrid}>
          <div className={styles.chatContainer}>
          <div className={styles.header}>
            <h1>Skill Assessment</h1>
            <p>
              {isComplete
                ? 'Assessment complete! Review your skill profile below.'
                : `Turn ${currentTurn}/4: ${TURN_LABELS_FULL[currentTurn as keyof typeof TURN_LABELS_FULL]}`}
            </p>
          </div>

          <div className={styles.messagesContainer}>
            {initializing ? (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <div className={styles.messageContent}>
                  <div className={styles.typing}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.message} ${
                      message.role === 'user' ? styles.userMessage : styles.assistantMessage
                    }`}
                  >
                    <div className={styles.messageContent}>{message.content}</div>
                    <div className={styles.messageTime}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className={`${styles.message} ${styles.assistantMessage}`}>
                    <div className={styles.messageContent}>
                      <div className={styles.typing}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {!isComplete && (
            <div className={styles.inputContainer}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className={styles.input}
                rows={3}
                disabled={loading || initializing}
              />
              <button
                onClick={handleSend}
                className={styles.sendButton}
                disabled={!input.trim() || loading || initializing}
              >
                <Send size={20} />
              </button>
            </div>
          )}
          </div>

          {/* Skill Profile Sidebar - Always visible, shows real-time updates */}
          <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Your Skills</h2>
            {skillProfile && skillProfile.extracted_skills.length > 0 && !showValidation && (
              <button onClick={handleRedoAssessment} className={styles.redoButton}>
                <RefreshCw size={16} />
                Redo Assessment
              </button>
            )}
          </div>
          
          {skillProfile && skillProfile.extracted_skills && skillProfile.extracted_skills.length > 0 ? (
            <>
            <div className={styles.skillsSummary}>
              <div className={styles.summaryBadge}>
                <Sparkles size={16} />
                <span>{skillProfile.extracted_skills.length} Skills Identified</span>
              </div>
            </div>

            <div className={styles.skillSection}>
              <h3>Job Title</h3>
              <p className={styles.jobTitle}>{skillProfile?.raw_job_title || 'Not specified'}</p>
            </div>

            {skillProfile && skillProfile.extracted_skills.length > 0 && (
              <div className={styles.skillSection}>
                <h3>Extracted Skills</h3>
                {skillProfile.extracted_skills.map((skill, index) => (
                  <div key={index} className={styles.skillCard}>
                    <div className={styles.skillCategory}>{skill.category}</div>
                    <div className={styles.skillPhrase}>"{skill.user_phrase}"</div>
                    <div className={styles.onetCodes}>
                      <strong>O*NET Codes:</strong>
                      <ul>
                        {skill.onet_task_codes.map((code, codeIndex) => (
                          <li key={codeIndex} className={styles.onetCode}>
                            {code}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showValidation && (
              <div className={styles.validationSection}>
                <div className={styles.validationHeader}>
                  <CheckCircle className={styles.validationIcon} />
                  <h3>Review Your Profile</h3>
                </div>
                <p className={styles.validationText}>
                  Please review your skill profile above. This will be used to match you with
                  career opportunities and identify learning resources.
                </p>
                <div className={styles.validationActions}>
                  <button onClick={handleConfirmProfile} className={styles.confirmButton}>
                    <CheckCircle size={18} />
                    Confirm & Continue
                  </button>
                  <button onClick={handleEditProfile} className={styles.editButton}>
                    Edit Profile
                  </button>
                </div>
              </div>
            )}

            {skillProfile && !showValidation && (
              <button onClick={handleComplete} className={styles.completeButton}>
                Find Matching Careers
              </button>
            )}
            </>
          ) : (
            <div className={styles.emptySkillsState}>
              <Sparkles className={styles.emptyIcon} size={48} />
              <p className={styles.emptyText}>
                {sessionId 
                  ? 'Your skills will appear here as you progress through the assessment...'
                  : 'Start the assessment to identify your skills'}
              </p>
              {!sessionId && !skillProfile && (
                <button onClick={handleRedoAssessment} className={styles.startButton}>
                  Start Assessment
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillAssessment;
