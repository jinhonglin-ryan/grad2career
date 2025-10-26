import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import styles from './AuthPages.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      await googleLogin();
    } catch (err: any) {
      setError(err.message || 'Failed to login with Google');
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <div className={styles.backButton} onClick={handleBackToHome}>
          ← Back to Home
        </div>
        
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Briefcase className={styles.icon} />
          </div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Log in to continue your career journey</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email Address</label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.forgotPassword}>
            <span>Forgot password?</span>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Logging in...
              </>
            ) : (
              'Log In'
            )}
          </button>

          <div className={styles.divider}>
            <span>or continue with</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className={styles.googleButton}
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className={styles.switchText}>
            Don't have an account?{' '}
            <span onClick={() => navigate('/signup')} className={styles.link}>
              Sign up for free
            </span>
          </p>
        </form>
      </div>

      <div className={styles.testimonial}>
        <div className={styles.testimonialContent}>
          <p className={styles.quote}>
            "SkillBridge helped me transition from coal mining to renewable energy. 
            The AI assessment identified skills I didn't even know were transferable!"
          </p>
          <div className={styles.author}>
            <div className={styles.authorInfo}>
              <p className={styles.authorName}>James Mitchell</p>
              <p className={styles.authorTitle}>Solar Panel Installer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
