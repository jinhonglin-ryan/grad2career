import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, CheckCircle, RefreshCw, Sparkles, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Logo from '../components/Logo';
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
  const [assessmentMode, setAssessmentMode] = useState<'choice' | 'questionnaire' | 'chat' | 'completed'>('choice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [skillProfile, setSkillProfile] = useState<SkillProfile | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Ensure layout is calculated correctly on mount/navigation
  useLayoutEffect(() => {
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
          // Show existing skills - user can choose to update
          setAssessmentMode('completed');
        } else {
          // No existing assessment - show choice screen
          setAssessmentMode('choice');
        }
      } catch (error) {
        console.error('Error loading existing skills:', error);
        // If no existing skills, show choice screen
        setAssessmentMode('choice');
      }
    };

    loadExistingSkills();
  }, [user?.id]);

  // Initialize chat assessment when user selects chat mode
  const startChatAssessment = async () => {
    try {
      setInitializing(true);
      setAssessmentMode('chat');
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
      toast.error('Failed to start assessment. Please refresh the page and try again.');
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

  const startQuestionnaire = () => {
    navigate('/assessment/questionnaire');
  };

  // Helper function to clean response messages (remove JSON schema if present)
  const cleanResponseMessage = (message: string): string => {
    // Remove JSON blocks that might be in the response
    let cleaned = message;
    
    // Remove JSON code blocks
    if (cleaned.includes('```json')) {
      const jsonStart = cleaned.indexOf('```json');
      const jsonEnd = cleaned.indexOf('```', jsonStart + 7);
      if (jsonEnd > jsonStart) {
        // Keep text before JSON block
        const beforeJson = cleaned.substring(0, jsonStart).trim();
        // Keep text after JSON block if any
        const afterJson = cleaned.substring(jsonEnd + 3).trim();
        cleaned = beforeJson + (afterJson ? '\n\n' + afterJson : '');
      }
    } else if (cleaned.includes('```')) {
      // Handle plain code blocks
      const codeStart = cleaned.indexOf('```');
      const codeEnd = cleaned.indexOf('```', codeStart + 3);
      if (codeEnd > codeStart) {
        const beforeCode = cleaned.substring(0, codeStart).trim();
        const afterCode = cleaned.substring(codeEnd + 3).trim();
        cleaned = beforeCode + (afterCode ? '\n\n' + afterCode : '');
      }
    }
    
    // Remove standalone JSON objects that look like schemas
    if (cleaned.includes('"user_id"') || cleaned.includes('"extracted_skills"')) {
      // Try to find and remove JSON object
      const jsonObjStart = cleaned.indexOf('{');
      const jsonObjEnd = cleaned.lastIndexOf('}');
      if (jsonObjStart !== -1 && jsonObjEnd !== -1 && jsonObjEnd > jsonObjStart) {
        // Check if this looks like the schema by looking for key fields
        const jsonSection = cleaned.substring(jsonObjStart, jsonObjEnd + 1);
        if (jsonSection.includes('"user_id"') && jsonSection.includes('"extracted_skills"')) {
          // Remove the JSON object, keep text before and after
          const beforeJson = cleaned.substring(0, jsonObjStart).trim();
          const afterJson = cleaned.substring(jsonObjEnd + 1).trim();
          cleaned = beforeJson + (afterJson ? '\n\n' + afterJson : '');
        }
      }
    }
    
    return cleaned.trim() || message; // Return original if cleaning removes everything
  };

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

      // Clean the response to remove any JSON schema that shouldn't be shown
      const cleanedResponse = cleanResponseMessage(response.data.response);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: cleanedResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentTurn(response.data.current_turn);

      // Update skill profile in real-time if partial data is available
      if (response.data.skill_profile && response.data.skill_profile.extracted_skills) {
        setSkillProfile(response.data.skill_profile);
      }

      // If assessment is complete, update skill profile (will show action buttons)
      if (response.data.is_complete && response.data.skill_profile) {
        setSkillProfile(response.data.skill_profile);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Show appropriate error message based on error type
      if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please check your connection.');
      } else if (error.response?.status === 429) {
        toast.warning('Too many requests. Please wait a moment and try again.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to send message. Please try again.');
      }
      
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

  const handleSaveAndFindCareers = async () => {
    if (!skillProfile || !user?.id) {
      toast.error('No skill profile to save');
      return;
    }

    setIsSaving(true);
    try {
      // Save the skill profile to backend
      await api.post('/skills/save', {
        user_id: user.id,
        skill_profile: skillProfile
      });
      
      toast.success('Skill profile saved successfully!');
      
      // Navigate to career matching
      setTimeout(() => {
        navigate('/careers', { state: { skillProfile } });
      }, 500);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile. But you can still explore careers.');
      
      // Even if save fails, allow navigation to careers
      setTimeout(() => {
        navigate('/careers', { state: { skillProfile } });
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedoAssessment = async () => {
    // Reset state for new assessment
    setSkillProfile(null);
    setMessages([]);
    setCurrentTurn(1);
    setSessionId(null);
    setExpandedSkills(new Set());
    
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
      toast.error('Failed to restart assessment. Please try again.');
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
  // Toggle skill technical details
  const toggleSkillDetails = (index: number) => {
    setExpandedSkills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const isComplete = currentTurn >= 4 && skillProfile !== null;

  // Choice screen - show when user needs to pick assessment method
  if (assessmentMode === 'choice') {
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
          <div className={styles.choiceContainer}>
            <div className={styles.choiceHeader}>
              <h1>Choose Your Assessment Method</h1>
              <p>Select the best way to assess your mining skills and experience</p>
            </div>

            <div className={styles.choiceCards}>
              <div 
                className={`${styles.choiceCard} ${styles.recommended}`}
                onClick={startQuestionnaire}
              >
                <div className={styles.choiceBadge}>Recommended for Coal Miners</div>
                <div className={styles.choiceIcon}>
                  <Target size={48} />
                </div>
                <h2>Structured Questionnaire</h2>
                <p className={styles.choiceDescription}>
                  Answer targeted questions about your mining experience. Faster and more accurate for coal industry workers.
                </p>
                <ul className={styles.choiceFeatures}>
                  <li>✓ Mining-specific questions</li>
                  <li>✓ Faster completion (~5 minutes)</li>
                  <li>✓ More reliable skill extraction</li>
                  <li>✓ No AI interpretation needed</li>
                </ul>
                <button className={styles.choiceButton}>
                  Start Questionnaire →
                </button>
              </div>

              <div 
                className={styles.choiceCard}
                onClick={startChatAssessment}
              >
                <div className={styles.choiceIcon}>
                  <Sparkles size={48} />
                </div>
                <h2>AI Conversation</h2>
                <p className={styles.choiceDescription}>
                  Have a natural conversation with our AI assistant. More flexible but takes longer.
                </p>
                <ul className={styles.choiceFeatures}>
                  <li>✓ Natural conversation flow</li>
                  <li>✓ AI-guided questions</li>
                  <li>✓ More detailed exploration</li>
                  <li>✓ ~15 minutes</li>
                </ul>
                <button className={styles.choiceButton}>
                  Start Chat Assessment →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed assessment view
  if (assessmentMode === 'completed' && skillProfile) {
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
          <div className={styles.completedView}>
            <div className={styles.completedHeader}>
              <CheckCircle size={48} className={styles.successIcon} />
              <h1>Assessment Complete</h1>
              <p>Your skills have been identified. You can update your assessment or explore careers.</p>
            </div>

            <div className={styles.completedActions}>
              <button 
                onClick={startQuestionnaire}
                className={styles.updateButton}
              >
                <RefreshCw size={18} />
                Update with Questionnaire
              </button>
              <button 
                onClick={startChatAssessment}
                className={styles.updateButton}
              >
                <Sparkles size={18} />
                Update with Chat
              </button>
              <button 
                onClick={() => navigate('/careers')}
                className={styles.primaryButton}
              >
                <Briefcase size={18} />
                Explore Careers
              </button>
            </div>

            <div className={styles.skillsDisplay}>
              <h2>Your Identified Skills ({skillProfile.extracted_skills.length})</h2>
              <div className={styles.skillGrid}>
                {skillProfile.extracted_skills.map((skill, index) => (
                  <div key={index} className={styles.skillCard}>
                    <div className={styles.skillCategory}>{skill.category}</div>
                    <div className={styles.skillPhrase}>{skill.user_phrase}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            
            {/* Progress bar */}
            {!isComplete && (
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBarBackground}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${(currentTurn / 4) * 100}%` }}
                  >
                    <span className={styles.progressBarText}>{currentTurn}/4 Complete</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.messagesContainer}>
            {initializing ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSkeleton}>
                  <div className={styles.skeletonAvatar}></div>
                  <div className={styles.skeletonContent}>
                    <div className={styles.skeletonLine} style={{ width: '80%' }}></div>
                    <div className={styles.skeletonLine} style={{ width: '60%' }}></div>
                    <div className={styles.skeletonLine} style={{ width: '70%' }}></div>
                  </div>
                </div>
                <p className={styles.loadingText}>Initializing assessment...</p>
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
                aria-label="Message input"
              />
              <button
                onClick={handleSend}
                className={styles.sendButton}
                disabled={!input.trim() || loading || initializing}
                aria-label="Send message"
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
            {skillProfile && skillProfile.extracted_skills.length > 0 && (
              <button onClick={handleRedoAssessment} className={styles.redoButton} title="Start a new assessment">
                <RefreshCw size={16} />
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

            <div className={styles.skillSection}>
              <h3>Extracted Skills</h3>
              {skillProfile.extracted_skills.map((skill, index) => {
                const isExpanded = expandedSkills.has(index);
                return (
                  <div key={index} className={styles.skillCard}>
                    <div className={styles.skillCategory}>{skill.category}</div>
                    <div className={styles.skillPhrase}>"{skill.user_phrase}"</div>
                    
                    {/* Toggle technical details button */}
                    <button 
                      onClick={() => toggleSkillDetails(index)}
                      className={styles.toggleDetailsButton}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={16} />
                          <span>Hide Technical Details</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          <span>Show Technical Details ({skill.onet_task_codes.length} O*NET codes)</span>
                        </>
                      )}
                    </button>
                    
                    {/* Collapsible O*NET codes */}
                    {isExpanded && (
                      <div className={styles.onetCodes}>
                        <strong>O*NET Task Codes:</strong>
                        <ul>
                          {skill.onet_task_codes.map((code, codeIndex) => (
                            <li key={codeIndex} className={styles.onetCode}>
                              {code}
                            </li>
                          ))}
                        </ul>
                        <p className={styles.onetExplanation}>
                          These are standardized occupation codes used to map skills to career pathways.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons - show when not actively in assessment */}
            {(!sessionId || isComplete) && (
              <div className={styles.actionSection}>
                <button 
                  onClick={handleSaveAndFindCareers} 
                  className={styles.primaryActionButton}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={18} className={styles.spinning} />
                      Saving...
                    </>
                  ) : (
                    <>
                      {isComplete ? <CheckCircle size={18} /> : <Briefcase size={18} />}
                      {isComplete ? 'Save & Find Careers' : 'Find Matching Careers'}
                    </>
                  )}
                </button>
              </div>
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
