import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import api from '../services/api';
import styles from './OAuthCallback.module.css';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your login...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from URL parameters
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(decodeURIComponent(error));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (token) {
          // Store the token
          localStorage.setItem('authToken', token);
          
          // Check if this is a new user (needs onboarding)
          const isNewUser = searchParams.get('new_user');
          
          setStatus('success');
          setMessage('Login successful! Redirecting...');
          
          // Fetch user profile to check onboarding status
          try {
            const response = await api.get('/auth/me');
            const userData = response.data;
            // Store onboarding status in localStorage
            if (userData.onboarding_completed) {
              localStorage.setItem('onboarding_completed', 'true');
            } else {
              localStorage.removeItem('onboarding_completed');
            }
            
            // Redirect based on onboarding status
            setTimeout(() => {
              if (isNewUser === 'true' || !userData.onboarding_completed) {
                // New user or incomplete onboarding - go to onboarding
                navigate('/onboarding', { replace: true });
              } else {
                // Existing user with completed onboarding - go to dashboard
                navigate('/dashboard', { replace: true });
              }
            }, 1500);
          } catch (err) {
            console.error('Failed to fetch user profile:', err);
            // Fallback to new_user parameter if API call fails
            setTimeout(() => {
              if (isNewUser === 'true') {
                navigate('/onboarding', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            }, 1500);
          }
        } else {
          setStatus('error');
          setMessage('Authentication failed. No token received.');
          setTimeout(() => navigate('/login'), 3000);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage('An error occurred during authentication.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <Briefcase className={styles.icon} />
        </div>
        
        {status === 'processing' && (
          <>
            <div className={styles.spinner}></div>
            <h1 className={styles.title}>{message}</h1>
            <p className={styles.subtitle}>Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h1 className={styles.title}>{message}</h1>
            <p className={styles.subtitle}>Taking you to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className={styles.errorIcon}>✕</div>
            <h1 className={styles.title}>Authentication Failed</h1>
            <p className={styles.subtitle}>{message}</p>
            <button onClick={() => navigate('/login')} className={styles.retryButton}>
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;

