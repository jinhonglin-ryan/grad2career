import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, User, Target, Briefcase as WorkIcon, Award, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './OnboardingPage.module.css';

interface FormData {
  currentRole?: string;
  yearsOfExperience?: string;
  industry?: string;
  location?: string;
  skills: string[];
  workExperience: string;
  careerGoals: string;
  certifications: string[];
  lookingFor: string[];
}

const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
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
    currentRole: '',
    yearsOfExperience: '',
    industry: '',
    location: '',
    skills: [],
    workExperience: '',
    careerGoals: '',
    certifications: [],
    lookingFor: [],
  });

  const totalSteps = 4;

  const industries = [
    'Coal Mining',
    'Oil & Gas',
    'Manufacturing',
    'Construction',
    'Transportation',
    'Agriculture',
    'Other',
  ];

  const careerGoalOptions = [
    'Transition to Renewable Energy',
    'Learn New Technology Skills',
    'Get Industry Certification',
    'Increase Salary',
    'Better Work-Life Balance',
    'Remote Work Opportunity',
  ];

  const handleSkillAdd = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput('');
    }
  };

  const handleSkillRemove = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  const handleCertAdd = () => {
    if (certInput.trim() && !formData.certifications.includes(certInput.trim())) {
      setFormData({
        ...formData,
        certifications: [...formData.certifications, certInput.trim()],
      });
      setCertInput('');
    }
  };

  const handleCertRemove = (cert: string) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((c) => c !== cert),
    });
  };

  const handleLookingForToggle = (option: string) => {
    if (formData.lookingFor.includes(option)) {
      setFormData({
        ...formData,
        lookingFor: formData.lookingFor.filter((o) => o !== option),
      });
    } else {
      setFormData({
        ...formData,
        lookingFor: [...formData.lookingFor, option],
      });
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/auth/user/profile', formData);

      // 标记用户已完成 onboarding
      localStorage.setItem('onboarding_completed', 'true');
      
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      alert(error.response?.data?.detail || 'Failed to save your information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.currentRole && formData.yearsOfExperience && formData.industry;
      case 2:
        return formData.skills.length > 0 && formData.workExperience.trim();
      case 3:
        return formData.careerGoals.trim() && formData.lookingFor.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.logo}>
          <Briefcase size={32} />
          <span>SkillBridge</span>
        </div>

        <div className={styles.progress}>
          <h3>Getting Started</h3>
          <p>Help us understand your background</p>
          
          <div className={styles.steps}>
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`${styles.stepItem} ${
                  s === step ? styles.active : s < step ? styles.completed : ''
                }`}
              >
                <div className={styles.stepNumber}>{s}</div>
                <div className={styles.stepLabel}>
                  {s === 1 && 'Basic Info'}
                  {s === 2 && 'Experience'}
                  {s === 3 && 'Goals'}
                  {s === 4 && 'Review'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.helpText}>
          <p>💡 This helps us match you with the best career opportunities</p>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.formContainer}>
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <h1 className={styles.stepTitle}>
                <User size={32} />
                Tell us about your current situation
              </h1>
              <p className={styles.stepSubtitle}>This helps us understand your starting point</p>

              <div className={styles.formGroup}>
                <label>Current or Most Recent Role *</label>
                <input
                  type="text"
                  value={formData.currentRole}
                  onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                  placeholder="e.g., Coal Miner, Equipment Operator"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Years of Experience *</label>
                  <select
                    value={formData.yearsOfExperience}
                    onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="0-2">0-2 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="6-10">6-10 years</option>
                    <option value="11-20">11-20 years</option>
                    <option value="20+">20+ years</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Industry *</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Current Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                />
              </div>
            </div>
          )}

          {/* Step 2: Skills & Experience */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <h1 className={styles.stepTitle}>
                <WorkIcon size={32} />
                Your Skills & Experience
              </h1>
              <p className={styles.stepSubtitle}>What skills and experience do you bring?</p>

              <div className={styles.formGroup}>
                <label>Work Experience Description *</label>
                <textarea
                  value={formData.workExperience}
                  onChange={(e) => setFormData({ ...formData, workExperience: e.target.value })}
                  placeholder="Describe your main responsibilities, tools you've used, and achievements..."
                  rows={6}
                />
                <span className={styles.hint}>
                  Include specific tools, equipment, or technologies you've worked with
                </span>
              </div>

              <div className={styles.formGroup}>
                <label>Skills *</label>
                <div className={styles.tagInput}>
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleSkillAdd())}
                    placeholder="e.g., Heavy Equipment Operation, Safety Management"
                  />
                  <button type="button" onClick={handleSkillAdd}>
                    Add
                  </button>
                </div>
                <div className={styles.tags}>
                  {formData.skills.map((skill) => (
                    <span key={skill} className={styles.tag}>
                      {skill}
                      <button onClick={() => handleSkillRemove(skill)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Certifications (if any)</label>
                <div className={styles.tagInput}>
                  <input
                    type="text"
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleCertAdd())}
                    placeholder="e.g., MSHA Certification, CDL License"
                  />
                  <button type="button" onClick={handleCertAdd}>
                    Add
                  </button>
                </div>
                <div className={styles.tags}>
                  {formData.certifications.map((cert) => (
                    <span key={cert} className={styles.tag}>
                      {cert}
                      <button onClick={() => handleCertRemove(cert)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Career Goals */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <h1 className={styles.stepTitle}>
                <Target size={32} />
                What are your career goals?
              </h1>
              <p className={styles.stepSubtitle}>Help us find the perfect match for you</p>

              <div className={styles.formGroup}>
                <label>Career Goals & Aspirations *</label>
                <textarea
                  value={formData.careerGoals}
                  onChange={(e) => setFormData({ ...formData, careerGoals: e.target.value })}
                  placeholder="What do you hope to achieve in your next career? What motivates you?"
                  rows={5}
                />
              </div>

              <div className={styles.formGroup}>
                <label>What are you looking for? * (Select all that apply)</label>
                <div className={styles.checkboxGrid}>
                  {careerGoalOptions.map((option) => (
                    <label key={option} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.lookingFor.includes(option)}
                        onChange={() => handleLookingForToggle(option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className={styles.stepContent}>
              <h1 className={styles.stepTitle}>
                <Award size={32} />
                Review Your Information
              </h1>
              <p className={styles.stepSubtitle}>Make sure everything looks good</p>

              <div className={styles.reviewSection}>
                <h3>Basic Information</h3>
                <div className={styles.reviewItem}>
                  <strong>Role:</strong> {formData.currentRole}
                </div>
                <div className={styles.reviewItem}>
                  <strong>Experience:</strong> {formData.yearsOfExperience} years
                </div>
                <div className={styles.reviewItem}>
                  <strong>Industry:</strong> {formData.industry}
                </div>
                {formData.location && (
                  <div className={styles.reviewItem}>
                    <strong>Location:</strong> {formData.location}
                  </div>
                )}
              </div>

              <div className={styles.reviewSection}>
                <h3>Skills</h3>
                <div className={styles.tags}>
                  {formData.skills.map((skill) => (
                    <span key={skill} className={styles.reviewTag}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {formData.certifications.length > 0 && (
                <div className={styles.reviewSection}>
                  <h3>Certifications</h3>
                  <div className={styles.tags}>
                    {formData.certifications.map((cert) => (
                      <span key={cert} className={styles.reviewTag}>
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.reviewSection}>
                <h3>Career Goals</h3>
                <p>{formData.careerGoals}</p>
              </div>

              <div className={styles.reviewSection}>
                <h3>Looking For</h3>
                <ul className={styles.reviewList}>
                  {formData.lookingFor.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className={styles.navigation}>
            {step > 1 && (
              <button onClick={handleBack} className={styles.backButton}>
                Back
              </button>
            )}
            
            {step < totalSteps ? (
              <button
                onClick={handleNext}
                className={styles.nextButton}
                disabled={!canProceed()}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;

