import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import Logo from '../components/Logo';
import styles from './MiningQuestionnaire.module.css';

interface QuestionnaireData {
  last_mining_job_title: string;
  years_experience: number | null;
  mining_type: string;
  operated_heavy_machinery: boolean;
  machinery_types: string[];
  performed_maintenance: boolean;
  maintenance_types: string[];
  safety_training_completed: boolean;
  safety_certifications: string[];
  supervised_team: boolean;
  team_size: number | null;
  welding_experience: boolean;
  electrical_work: boolean;
  blasting_experience: boolean;
  cdl_license: boolean;
}

const MINING_JOB_TITLES = [
  'Continuous Miner Operator',
  'Roof Bolter',
  'Longwall Miner',
  'Shuttle Car Driver',
  'Scoop Operator',
  'Maintenance Technician',
  'Electrician',
  'Supervisor / Foreman',
  'Other'
];

const MACHINERY_TYPES = [
  'Continuous Miner',
  'Shuttle Car',
  'Scoop',
  'Longwall Equipment',
  'Conveyor Belt Systems',
  'Roof Bolter',
  'Other'
];

const MAINTENANCE_TYPES = [
  'Hydraulic Systems',
  'Electrical Systems',
  'Conveyor Belts',
  'Pumps',
  'Motors',
  'Other'
];

const SAFETY_CERTIFICATIONS = [
  'MSHA',
  'OSHA',
  'First Aid / CPR',
  'Other'
];

const MiningQuestionnaire = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<QuestionnaireData>({
    last_mining_job_title: '',
    years_experience: null,
    mining_type: '',
    operated_heavy_machinery: false,
    machinery_types: [],
    performed_maintenance: false,
    maintenance_types: [],
    safety_training_completed: false,
    safety_certifications: [],
    supervised_team: false,
    team_size: null,
    welding_experience: false,
    electrical_work: false,
    blasting_experience: false,
    cdl_license: false,
  });

  const totalSteps = 5;

  const handleInputChange = (field: keyof QuestionnaireData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: keyof QuestionnaireData, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = (prev[field] as string[]) || [];
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] };
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error('Please log in to submit the questionnaire');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/skills/assess/questionnaire', {
        user_id: user.id,
        ...formData
      });

      if (response.data.success) {
        toast.success(`Success! We've identified ${response.data.skill_count} transferable skills.`);
        navigate('/careers');
      }
    } catch (error: any) {
      console.error('Error submitting questionnaire:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit questionnaire. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.last_mining_job_title && formData.years_experience && formData.mining_type;
      case 2:
        return true; // Optional section
      case 3:
        return true; // Optional section
      case 4:
        return true; // Optional section
      case 5:
        return true; // Review step
      default:
        return false;
    }
  };

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
          <h1>Mining Experience Assessment</h1>
          <p>Tell us about your mining background so we can identify your transferable skills</p>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <p className={styles.stepIndicator}>Step {currentStep} of {totalSteps}</p>
        </div>

        <div className={styles.formContainer}>
          {/* Step 1: Basic Mining Background */}
          {currentStep === 1 && (
            <div className={styles.step}>
              <h2>Basic Mining Background</h2>
              <div className={styles.formGroup}>
                <label>What was your last mining job title? *</label>
                <select
                  value={formData.last_mining_job_title}
                  onChange={(e) => handleInputChange('last_mining_job_title', e.target.value)}
                  className={styles.select}
                >
                  <option value="">Select a job title</option>
                  {MINING_JOB_TITLES.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>How many years of mining experience do you have? *</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.years_experience || ''}
                  onChange={(e) => handleInputChange('years_experience', parseInt(e.target.value) || null)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>What type of mining did you work in? *</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="mining_type"
                      value="underground"
                      checked={formData.mining_type === 'underground'}
                      onChange={(e) => handleInputChange('mining_type', e.target.value)}
                    />
                    Underground
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="mining_type"
                      value="surface"
                      checked={formData.mining_type === 'surface'}
                      onChange={(e) => handleInputChange('mining_type', e.target.value)}
                    />
                    Surface
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="mining_type"
                      value="both"
                      checked={formData.mining_type === 'both'}
                      onChange={(e) => handleInputChange('mining_type', e.target.value)}
                    />
                    Both
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Equipment & Machinery */}
          {currentStep === 2 && (
            <div className={styles.step}>
              <h2>Equipment & Machinery Experience</h2>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.operated_heavy_machinery}
                    onChange={(e) => handleInputChange('operated_heavy_machinery', e.target.checked)}
                  />
                  Did you operate heavy machinery?
                </label>
              </div>

              {formData.operated_heavy_machinery && (
                <div className={styles.formGroup}>
                  <label>What types of machinery did you operate? (Select all that apply)</label>
                  <div className={styles.checkboxGroup}>
                    {MACHINERY_TYPES.map(type => (
                      <label key={type} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.machinery_types.includes(type)}
                          onChange={(e) => handleCheckboxChange('machinery_types', type, e.target.checked)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Maintenance & Repair */}
          {currentStep === 3 && (
            <div className={styles.step}>
              <h2>Maintenance & Repair Experience</h2>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.performed_maintenance}
                    onChange={(e) => handleInputChange('performed_maintenance', e.target.checked)}
                  />
                  Did you perform maintenance or repair work?
                </label>
              </div>

              {formData.performed_maintenance && (
                <div className={styles.formGroup}>
                  <label>What types of maintenance did you perform? (Select all that apply)</label>
                  <div className={styles.checkboxGroup}>
                    {MAINTENANCE_TYPES.map(type => (
                      <label key={type} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.maintenance_types.includes(type)}
                          onChange={(e) => handleCheckboxChange('maintenance_types', type, e.target.checked)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Safety & Leadership */}
          {currentStep === 4 && (
            <div className={styles.step}>
              <h2>Safety Training & Leadership</h2>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.safety_training_completed}
                    onChange={(e) => handleInputChange('safety_training_completed', e.target.checked)}
                  />
                  Did you complete safety training?
                </label>
              </div>

              {formData.safety_training_completed && (
                <div className={styles.formGroup}>
                  <label>What safety certifications do you have? (Select all that apply)</label>
                  <div className={styles.checkboxGroup}>
                    {SAFETY_CERTIFICATIONS.map(cert => (
                      <label key={cert} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.safety_certifications.includes(cert)}
                          onChange={(e) => handleCheckboxChange('safety_certifications', cert, e.target.checked)}
                        />
                        {cert}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.supervised_team}
                    onChange={(e) => handleInputChange('supervised_team', e.target.checked)}
                  />
                  Did you supervise a team?
                </label>
              </div>

              {formData.supervised_team && (
                <div className={styles.formGroup}>
                  <label>How many people were on your team?</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.team_size || ''}
                    onChange={(e) => handleInputChange('team_size', parseInt(e.target.value) || null)}
                    className={styles.input}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Additional Skills & Review */}
          {currentStep === 5 && (
            <div className={styles.step}>
              <h2>Additional Skills & Review</h2>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.welding_experience}
                    onChange={(e) => handleInputChange('welding_experience', e.target.checked)}
                  />
                  Welding experience
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.electrical_work}
                    onChange={(e) => handleInputChange('electrical_work', e.target.checked)}
                  />
                  Electrical work experience
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.blasting_experience}
                    onChange={(e) => handleInputChange('blasting_experience', e.target.checked)}
                  />
                  Blasting experience
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.cdl_license}
                    onChange={(e) => handleInputChange('cdl_license', e.target.checked)}
                  />
                  Commercial Driver's License (CDL)
                </label>
              </div>

              <div className={styles.reviewSection}>
                <h3>Review Your Information</h3>
                <div className={styles.reviewItem}>
                  <strong>Job Title:</strong> {formData.last_mining_job_title || 'Not specified'}
                </div>
                <div className={styles.reviewItem}>
                  <strong>Experience:</strong> {formData.years_experience || 'Not specified'} years
                </div>
                <div className={styles.reviewItem}>
                  <strong>Mining Type:</strong> {formData.mining_type || 'Not specified'}
                </div>
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            {currentStep > 1 && (
              <button onClick={handleBack} className={styles.backButton}>
                Back
              </button>
            )}
            {currentStep < totalSteps ? (
              <button 
                onClick={handleNext} 
                className={styles.nextButton}
                disabled={!canProceed()}
              >
                Next
              </button>
            ) : (
              <button 
                onClick={handleSubmit} 
                className={styles.submitButton}
                disabled={loading || !canProceed()}
              >
                {loading ? 'Submitting...' : 'Submit Assessment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiningQuestionnaire;

