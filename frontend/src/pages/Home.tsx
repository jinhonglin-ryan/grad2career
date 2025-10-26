import { ReactNode } from 'react';
import { Briefcase, TrendingUp, BookOpen, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';

interface ButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
}

const Button = ({ children, className, variant = 'primary', onClick }: ButtonProps) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className || ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card = ({ children, className }: CardProps) => {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      {children}
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();

  const safeNavigate = (path: string) => {
    try {
      navigate(path);
    } catch (error) {
      console.error('Navigation failed:', error);
      alert('Something went wrong navigating to that page. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <Briefcase className={styles.logoIcon} />
            <span className={styles.logoText}>SkillBridge</span>
          </div>
          <div className={styles.navLinks}>
            <Button onClick={() => navigate('/signup')}>Get Started</Button>
            <Button onClick={() => navigate('/login')}>Log In</Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Your Bridge to a New Career</h1>
        <p className={styles.heroText}>
          AI-powered career transition platform helping displaced workers find new opportunities,
          assess skills, and build personalized learning paths for success.
        </p>
        <Button
          className={styles.heroButton}
          onClick={() => safeNavigate('/signup')}
        >
          Start Your Journey Today
        </Button>
      </div>

      {/* FEATURES */}
      <div className={styles.features}>
        <div className={styles.featureGrid}>
          <Card>
            <Target className={styles.featureIcon} />
            <h3 className={styles.featureTitle}>Skill Assessment</h3>
            <p className={styles.featureText}>
              Our conversational AI helps you identify and document your transferable skills,
              even from informal work experience.
            </p>
          </Card>

          <Card>
            <TrendingUp className={styles.featureIcon} />
            <h3 className={styles.featureTitle}>Career Matching</h3>
            <p className={styles.featureText}>
              Discover careers that match your skills and interests, with detailed gap analysis
              showing what you need to learn.
            </p>
          </Card>

          <Card>
            <BookOpen className={styles.featureIcon} />
            <h3 className={styles.featureTitle}>Learning Paths</h3>
            <p className={styles.featureText}>
              Get personalized, week-by-week training plans with free and affordable resources
              tailored to your schedule and budget.
            </p>
          </Card>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How SkillBridge Works</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>1</div>
            <h3 className={styles.stepTitle}>Assess Your Skills</h3>
            <p className={styles.stepText}>
              Chat with our AI to build a comprehensive profile of your skills and experience
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>2</div>
            <h3 className={styles.stepTitle}>Explore Careers</h3>
            <p className={styles.stepText}>
              Discover matching career opportunities and understand the skill gaps
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>3</div>
            <h3 className={styles.stepTitle}>Follow Your Path</h3>
            <p className={styles.stepText}>
              Get a personalized learning plan with courses, certifications, and resources
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className={styles.stats}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>5,000+</div>
            <div className={styles.statLabel}>Career Transitions</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>92%</div>
            <div className={styles.statLabel}>Success Rate</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>100+</div>
            <div className={styles.statLabel}>Career Paths</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Briefcase className={styles.footerIcon} />
              <span className={styles.footerLogo}>SkillBridge</span>
              <p className={styles.footerText}>
                Empowering displaced workers with AI-driven career transition support.
              </p>
            </div>
            <div className={styles.footerLinks}>
              <h4>Platform</h4>
              <ul>
                <li onClick={() => navigate('/assessment')}>Skill Assessment</li>
                <li onClick={() => navigate('/careers')}>Career Matching</li>
                <li onClick={() => navigate('/learning')}>Learning Paths</li>
              </ul>
            </div>
          </div>
          <div className={styles.copyright}>
            © 2025 SkillBridge. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

