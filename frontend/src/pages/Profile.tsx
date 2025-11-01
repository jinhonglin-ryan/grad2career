import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, User, Mail, Calendar, MapPin, Target, TrendingUp, BookOpen, Edit2, Save, X, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './Profile.module.css';

interface FullProfile {
  user: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    auth_provider: string;
    onboarding_completed: boolean;
    created_at?: string;
    updated_at?: string;
  };
  profile: {
    skills?: string[];
    tools?: string[];
    certifications?: string[];
    work_experience?: string;
    career_goals?: string;
    updated_at?: string;
  } | null;
  metadata: {
    current_zip_code?: string;
    travel_constraint?: string;
    budget_constraint?: string;
    scheduling?: string;
    weekly_hours_constraint?: string;
    transition_goal?: string;
    transition_goal_text?: string;
    target_sector?: string;
    age?: string;
    veteran_status?: string;
  };
}

const Profile = () => {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<{
    name?: string;
    career_goals?: string;
    work_experience?: string;
  }>({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!authUser?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/user/profile');
        setFullProfile(response.data);
        setEditData({
          name: response.data.user.name || '',
          career_goals: response.data.profile?.career_goals || '',
          work_experience: response.data.profile?.work_experience || '',
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authUser?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/auth/user/profile', editData);
      // Refresh profile data
      const response = await api.get('/auth/user/profile');
      setFullProfile(response.data);
      setEditData({
        name: response.data.user.name || '',
        career_goals: response.data.profile?.career_goals || '',
        work_experience: response.data.profile?.work_experience || '',
      });
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(error.response?.data?.detail || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (fullProfile) {
      setEditData({
        name: fullProfile.user.name || '',
        career_goals: fullProfile.profile?.career_goals || '',
        work_experience: fullProfile.profile?.work_experience || '',
      });
    }
    setEditing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getTravelConstraintLabel = (value?: string) => {
    const map: Record<string, string> = {
      '15min': 'Up to 15 Minutes',
      '30min': 'Up to 30 Minutes',
      '45min': 'Up to 45 Minutes',
      'remote': 'Remote or Flexible Learning',
    };
    return map[value || ''] || value || 'Not specified';
  };

  const getBudgetConstraintLabel = (value?: string) => {
    const map: Record<string, string> = {
      'free': 'Free or Grant-Eligible',
      '1000': 'Up to $1,000',
      'flexible': 'Flexible Budget',
    };
    return map[value || ''] || value || 'Not specified';
  };

  const getTransitionGoalLabel = (value?: string) => {
    if (!value) return 'Not specified';
    if (value.includes('quick')) return 'Get back to work quickly (6 months)';
    if (value.includes('earnings')) return 'Higher long-term earnings';
    if (value.includes('stable')) return 'Career change to a stable industry';
    return value;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading profile...</div>
      </div>
    );
  }

  if (!fullProfile) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load profile. Please try again later.</div>
      </div>
    );
  }

  const { user, profile, metadata } = fullProfile;

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => navigate('/dashboard')}>
            <div className={styles.logoIconWrapper}>
              <Briefcase className={styles.logoIcon} />
            </div>
            <span className={styles.logoText}>SkillBridge</span>
          </div>
          <div className={styles.navRight}>
            <button onClick={() => navigate('/dashboard')} className={styles.backButton}>
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
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>My Profile</h1>
            <p className={styles.subtitle}>View and manage your account information</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className={styles.editButton}>
              <Edit2 size={18} />
              Edit Profile
            </button>
          )}
          {editing && (
            <div className={styles.editActions}>
              <button onClick={handleSave} className={styles.saveButton} disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCancel} className={styles.cancelButton} disabled={saving}>
                <X size={18} />
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className={styles.contentGrid}>
          {/* Account Information */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <User size={20} />
              <h2>Account Information</h2>
            </div>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>
                {user.picture ? (
                  <img src={user.picture} alt={user.name || 'User'} />
                ) : (
                  <span>{user.name?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className={styles.profileInfo}>
                {editing ? (
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Full Name"
                    className={styles.input}
                  />
                ) : (
                  <h3>{user.name || 'Not set'}</h3>
                )}
                <div className={styles.emailRow}>
                  <Mail size={16} />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Login Status</span>
                <span className={styles.infoValue}>
                  <CheckCircle2 size={16} className={styles.successIcon} />
                  Logged In
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Auth Provider</span>
                <span className={styles.infoValue}>
                  {user.auth_provider === 'google' ? 'Google' : 'Email'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Account Created</span>
                <span className={styles.infoValue}>{formatDate(user.created_at)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Last Updated</span>
                <span className={styles.infoValue}>{formatDate(user.updated_at)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Onboarding</span>
                <span className={styles.infoValue}>
                  {user.onboarding_completed ? (
                    <>
                      <CheckCircle2 size={16} className={styles.successIcon} />
                      Completed
                    </>
                  ) : (
                    'Not completed'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Career Goals & Experience */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Target size={20} />
              <h2>Career Goals & Experience</h2>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Career Goals</label>
              {editing ? (
                <textarea
                  value={editData.career_goals || ''}
                  onChange={(e) => setEditData({ ...editData, career_goals: e.target.value })}
                  placeholder="Describe your career goals..."
                  className={styles.textarea}
                  rows={4}
                />
              ) : (
                <div className={styles.value}>
                  {profile?.career_goals || metadata.transition_goal_text || 'Not specified'}
                </div>
              )}
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Work Experience</label>
              {editing ? (
                <textarea
                  value={editData.work_experience || ''}
                  onChange={(e) => setEditData({ ...editData, work_experience: e.target.value })}
                  placeholder="Describe your work experience..."
                  className={styles.textarea}
                  rows={5}
                />
              ) : (
                <div className={styles.value}>
                  {profile?.work_experience || 'Not specified'}
                </div>
              )}
            </div>
            {metadata.target_sector && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Target Sector</label>
                <div className={styles.value}>{metadata.target_sector}</div>
              </div>
            )}
          </div>

          {/* Skills & Tools */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <TrendingUp size={20} />
              <h2>Skills & Tools</h2>
            </div>
            {profile?.skills && profile.skills.length > 0 ? (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Skills</label>
                <div className={styles.tagList}>
                  {profile.skills.map((skill, index) => (
                    <span key={index} className={styles.tag}>{skill}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Skills</label>
                <div className={styles.value}>No skills recorded yet. <button onClick={() => navigate('/assessment')} className={styles.linkButton}>Complete assessment</button></div>
              </div>
            )}
            {profile?.tools && profile.tools.length > 0 && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Tools</label>
                <div className={styles.tagList}>
                  {profile.tools.map((tool, index) => (
                    <span key={index} className={styles.tag}>{tool}</span>
                  ))}
                </div>
              </div>
            )}
            {profile?.certifications && profile.certifications.length > 0 && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Certifications</label>
                <div className={styles.tagList}>
                  {profile.certifications.map((cert, index) => (
                    <span key={index} className={styles.tag}>{cert}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Logistical Constraints */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <MapPin size={20} />
              <h2>Logistical Constraints</h2>
            </div>
            <div className={styles.infoGrid}>
              {metadata.current_zip_code && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Zip Code</span>
                  <span className={styles.infoValue}>{metadata.current_zip_code}</span>
                </div>
              )}
              {metadata.travel_constraint && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <Clock size={16} />
                    Travel Constraint
                  </span>
                  <span className={styles.infoValue}>
                    {getTravelConstraintLabel(metadata.travel_constraint)}
                  </span>
                </div>
              )}
              {metadata.budget_constraint && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <DollarSign size={16} />
                    Budget Constraint
                  </span>
                  <span className={styles.infoValue}>
                    {getBudgetConstraintLabel(metadata.budget_constraint)}
                  </span>
                </div>
              )}
              {metadata.scheduling && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Scheduling</span>
                  <span className={styles.infoValue}>{metadata.scheduling}</span>
                </div>
              )}
              {metadata.weekly_hours_constraint && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Weekly Hours</span>
                  <span className={styles.infoValue}>{metadata.weekly_hours_constraint}</span>
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          {(metadata.age || metadata.veteran_status) && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <User size={20} />
                <h2>Additional Information</h2>
              </div>
              <div className={styles.infoGrid}>
                {metadata.age && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age Range</span>
                    <span className={styles.infoValue}>{metadata.age}</span>
                  </div>
                )}
                {metadata.veteran_status && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Veteran Status</span>
                    <span className={styles.infoValue}>
                      {metadata.veteran_status === 'yes' ? 'Yes' : 
                       metadata.veteran_status === 'no' ? 'No' : 
                       'Prefer Not to Say'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
