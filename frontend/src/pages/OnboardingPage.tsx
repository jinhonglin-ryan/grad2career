import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Clock, DollarSign, Calendar, Target, User, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './OnboardingPage.module.css';

interface FormData {
  // Screen 1: Logistical Constraints
  currentZipCode: string;
  travelConstraint: string;
  budgetConstraint: string;
  scheduling: string;
  weeklyHoursConstraint: string;
  
  // Screen 2: Motivation & Context
  transitionGoal: string;
  targetSector: string;
  age?: string;
  veteranStatus?: string;
}

interface Question {
  id: string;
  field: keyof FormData;
  label: string;
  icon: React.ReactNode;
  type: 'input' | 'radio';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required: boolean;
  hint?: string;
}

const OnboardingPage = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if user has token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const [formData, setFormData] = useState<FormData>({
    currentZipCode: '',
    travelConstraint: '',
    budgetConstraint: '',
    scheduling: '',
    weeklyHoursConstraint: '',
    transitionGoal: '',
    targetSector: '',
    age: undefined,
    veteranStatus: undefined,
  });

  // Define all questions in order
  const questions: Question[] = [
    {
      id: 'zipCode',
      field: 'currentZipCode',
      label: 'Current Zip Code',
      icon: <MapPin size={24} />,
      type: 'input',
      placeholder: '12345',
      required: true,
      hint: '5-digit zip code required',
    },
    {
      id: 'travel',
      field: 'travelConstraint',
      label: 'Travel Constraint',
      icon: <Clock size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: '15min', label: 'Up to 15 Minutes' },
        { value: '30min', label: 'Up to 30 Minutes' },
        { value: '45min', label: 'Up to 45 Minutes' },
        { value: 'remote', label: 'I need remote or flexible learning' },
      ],
    },
    {
      id: 'budget',
      field: 'budgetConstraint',
      label: 'Budget Constraint',
      icon: <DollarSign size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: 'free', label: 'Must be Free or Grant-Eligible' },
        { value: '1000', label: 'I can budget up to $1,000' },
        { value: 'flexible', label: 'I have funds for training' },
      ],
    },
    {
      id: 'scheduling',
      field: 'scheduling',
      label: 'Scheduling',
      icon: <Calendar size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: 'fulltime', label: 'Full-time, weekdays' },
        { value: 'evenings', label: 'Evenings or weekends only' },
        { value: 'flexible', label: 'Fully flexible or self-paced' },
      ],
    },
    {
      id: 'weeklyHours',
      field: 'weeklyHoursConstraint',
      label: 'Weekly Hours Constraint',
      icon: <Clock size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: '1-5', label: '1-5 hours (Passive/Self-Study)' },
        { value: '6-15', label: '6-15 hours (Part-time commitment)' },
        { value: '16-30', label: '16-30 hours (Dedicated training)' },
        { value: '30+', label: '30+ hours (Full-time commitment)' },
      ],
    },
    {
      id: 'transitionGoal',
      field: 'transitionGoal',
      label: 'Transition Goal',
      icon: <Target size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: 'quick', label: 'Get back to work quickly (6 months)' },
        { value: 'earnings', label: 'Higher long-term earnings' },
        { value: 'stable', label: 'Career change to a stable industry' },
      ],
    },
    {
      id: 'targetSector',
      field: 'targetSector',
      label: 'Target Sector',
      icon: <Target size={24} />,
      type: 'radio',
      required: true,
      options: [
        { value: 'renewable', label: 'Renewable Energy (Solar/Wind)' },
        { value: 'construction', label: 'Construction/HVAC Trades' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'utility', label: 'Utility/Infrastructure' },
        { value: 'unknown', label: "I don't know yet" },
      ],
    },
    {
      id: 'age',
      field: 'age',
      label: 'Age',
      icon: <User size={24} />,
      type: 'radio',
      required: false,
      hint: 'Optional - Only used to match with age-restricted grant programs',
      options: [
        { value: '18-25', label: '18-25' },
        { value: '26-40', label: '26-40' },
        { value: '41-55', label: '41-55' },
        { value: '56+', label: '56+' },
      ],
    },
    {
      id: 'veteranStatus',
      field: 'veteranStatus',
      label: 'Veteran Status',
      icon: <User size={24} />,
      type: 'radio',
      required: false,
      hint: 'Optional - Used to surface veteran-specific training, funding, and resources',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'prefer-not', label: 'Prefer Not to Say' },
      ],
    },
  ];

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/auth/user/profile', formData);
      localStorage.setItem('onboarding_completed', 'true');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to save onboarding data:', error);
      alert(error.response?.data?.detail || 'Failed to save your information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    const value = formData[currentQuestion.field];
    
    if (currentQuestion.type === 'input') {
      // For zip code, check 5 digits
      if (currentQuestion.field === 'currentZipCode') {
        return typeof value === 'string' && value.trim().length === 5 && /^\d{5}$/.test(value);
      }
      return typeof value === 'string' && value.trim().length > 0;
    } else {
      // For radio buttons, check if a value is selected
      return value !== undefined && value !== '';
    }
  };

  const getQuestionValue = () => {
    return formData[currentQuestion.field] || '';
  };

  const handleValueChange = (value: string) => {
    setFormData({
      ...formData,
      [currentQuestion.field]: value,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.progressSidebar}>
        <div className={styles.logo}>
          <Briefcase size={28} />
          <span>SkillBridge</span>
        </div>

        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <h3>Getting Started</h3>
            <p>Question {currentQuestionIndex + 1} of {totalQuestions}</p>
          </div>

          <div className={styles.progressList}>
            {questions.map((question, index) => {
              const isCompleted = index < currentQuestionIndex;
              const isCurrent = index === currentQuestionIndex;
              const hasValue = formData[question.field] !== undefined && 
                              formData[question.field] !== '';

              return (
                <div
                  key={question.id}
                  className={`${styles.progressItem} ${
                    isCompleted ? styles.completed : ''
                  } ${isCurrent ? styles.current : ''} ${
                    !isCompleted && !isCurrent && hasValue ? styles.partial : ''
                  }`}
                >
                  <div className={styles.progressIcon}>
                    {isCompleted ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      question.icon
                    )}
                  </div>
                  <div className={styles.progressLabel}>
                    <span className={styles.questionNumber}>{index + 1}</span>
                    <span className={styles.questionText}>{question.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.questionContainer}>
          <div className={styles.questionHeader}>
            <div className={styles.questionIcon}>{currentQuestion.icon}</div>
            <div>
              <h1 className={styles.questionTitle}>{currentQuestion.label}</h1>
              {currentQuestion.hint && (
                <p className={styles.questionHint}>{currentQuestion.hint}</p>
              )}
              {!currentQuestion.required && (
                <span className={styles.optionalBadge}>(Optional)</span>
              )}
            </div>
          </div>

          <div className={styles.questionContent}>
            {currentQuestion.type === 'input' ? (
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  value={getQuestionValue() as string}
                  onChange={(e) => {
                    if (currentQuestion.field === 'currentZipCode') {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                      handleValueChange(value);
                    } else {
                      handleValueChange(e.target.value);
                    }
                  }}
                  placeholder={currentQuestion.placeholder || 'Enter your answer...'}
                  className={styles.questionInput}
                  autoFocus
                />
              </div>
            ) : (
              <div className={styles.optionsList}>
                {currentQuestion.options?.map((option) => (
                  <label
                    key={option.value}
                    className={`${styles.optionLabel} ${
                      getQuestionValue() === option.value ? styles.selected : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.field}
                      value={option.value}
                      checked={getQuestionValue() === option.value}
                      onChange={() => handleValueChange(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.questionNavigation}>
            {currentQuestionIndex > 0 && (
              <button onClick={handleBack} className={styles.backButton}>
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className={styles.nextButton}
              disabled={!canProceed() || loading}
            >
              {loading ? 'Saving...' : isLastQuestion ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
