import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
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
          
          // Redirect based on user status
          setTimeout(() => {
            if (isNewUser === 'true') {
              // New user - go to onboarding
              navigate('/onboarding', { replace: true });
            } else {
              // Existing user - go to dashboard
              navigate('/dashboard', { replace: true });
            }
          }, 1500);
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

