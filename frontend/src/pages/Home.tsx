import { ReactNode } from 'react';
import { TrendingUp, BookOpen, Target, Sparkles, Users, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import styles from './Home.module.css';

interface ButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'ghost' | 'outline';
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
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Logo variant="icon" />
          <div className={styles.navLinks}>
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Log In
            </Button>
            <Button onClick={() => navigate('/signup')}>
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <Sparkles size={16} />
            <span>AI-Powered Career Transition</span>
          </div>
          <h1 className={styles.heroTitle}>
            Your Bridge to a
            <span className={styles.gradient}> New Career</span>
          </h1>
          <p className={styles.heroText}>
            Transform your experience into opportunity. Our AI-powered platform helps displaced workers 
            discover new careers, assess transferable skills, and build personalized learning paths to success.
          </p>
          <div className={styles.heroButtons}>
            <Button
              className={styles.heroButton}
              onClick={() => safeNavigate('/signup')}
            >
              Start Your Journey
              <ArrowRight size={20} />
            </Button>
            <Button
              variant="outline"
              className={styles.heroButton}
              onClick={() => safeNavigate('/login')}
            >
              Sign In
            </Button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <CheckCircle size={20} />
              <span>Free to use</span>
            </div>
            <div className={styles.heroStat}>
              <CheckCircle size={20} />
              <span>No credit card required</span>
            </div>
            <div className={styles.heroStat}>
              <CheckCircle size={20} />
              <span>5,000+ success stories</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.floatingCard} style={{ animationDelay: '0s' }}>
            <Target size={24} />
            <span>Skill Assessment</span>
          </div>
          <div className={styles.floatingCard} style={{ animationDelay: '0.5s' }}>
            <TrendingUp size={24} />
            <span>Career Matching</span>
          </div>
          <div className={styles.floatingCard} style={{ animationDelay: '1s' }}>
            <BookOpen size={24} />
            <span>Learning Path</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Everything You Need to Succeed</h2>
          <p className={styles.sectionSubtitle}>
            Comprehensive tools to help you transition to your dream career
          </p>
        </div>
        <div className={styles.featureGrid}>
          <Card>
            <div className={styles.featureIconWrapper}>
              <Target className={styles.featureIcon} />
            </div>
            <h3 className={styles.featureTitle}>AI Skill Assessment</h3>
            <p className={styles.featureText}>
              Our conversational AI helps you identify and document your transferable skills,
              even from informal work experience. Get a complete skill profile in minutes.
            </p>
            <button className={styles.featureLink} onClick={() => navigate('/signup')}>
              Learn more →
            </button>
          </Card>

          <Card>
            <div className={styles.featureIconWrapper}>
              <TrendingUp className={styles.featureIcon} />
            </div>
            <h3 className={styles.featureTitle}>Smart Career Matching</h3>
            <p className={styles.featureText}>
              Discover careers that match your skills with detailed gap analysis.
              See exactly what you need to learn to make the transition.
            </p>
            <button className={styles.featureLink} onClick={() => navigate('/signup')}>
              Learn more →
            </button>
          </Card>

          <Card>
            <div className={styles.featureIconWrapper}>
              <BookOpen className={styles.featureIcon} />
            </div>
            <h3 className={styles.featureTitle}>Personalized Learning</h3>
            <p className={styles.featureText}>
              Get week-by-week training plans with free and affordable resources
              tailored to your schedule, budget, and learning style.
            </p>
            <button className={styles.featureLink} onClick={() => navigate('/signup')}>
              Learn more →
            </button>
          </Card>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <p className={styles.sectionSubtitle}>
            Three simple steps to start your career transformation
          </p>
        </div>
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Assess Your Skills</h3>
              <p className={styles.stepText}>
                Have a conversation with our AI assistant to build a comprehensive profile 
                of your skills, experience, and certifications.
              </p>
            </div>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Discover Opportunities</h3>
              <p className={styles.stepText}>
                Explore matching career paths with salary insights, growth projections,
                and detailed skill gap analysis.
              </p>
            </div>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Follow Your Path</h3>
              <p className={styles.stepText}>
                Get a personalized learning plan with curated courses, certifications,
                and resources to achieve your goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={styles.testimonials}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Success Stories</h2>
          <p className={styles.sectionSubtitle}>
            Real people, real career transformations
          </p>
        </div>
        <div className={styles.testimonialGrid}>
          <div className={styles.testimonialCard}>
            <div className={styles.quote}>"</div>
            <p className={styles.testimonialText}>
              SkillBridge helped me transition from coal mining to renewable energy. 
              The AI assessment identified skills I didn't even know were transferable!
            </p>
            <div className={styles.testimonialAuthor}>
              <div className={styles.authorAvatar}>JM</div>
              <div>
                <p className={styles.authorName}>James Mitchell</p>
                <p className={styles.authorTitle}>Coal Miner → Solar Panel Installer</p>
              </div>
            </div>
          </div>

          <div className={styles.testimonialCard}>
            <div className={styles.quote}>"</div>
            <p className={styles.testimonialText}>
              Within 3 months of using SkillBridge, I completed my certification and landed 
              a job with 40% higher salary. This platform changed my life!
            </p>
            <div className={styles.testimonialAuthor}>
              <div className={styles.authorAvatar}>SJ</div>
              <div>
                <p className={styles.authorName}>Sarah Johnson</p>
                <p className={styles.authorTitle}>Factory Worker → Wind Turbine Technician</p>
              </div>
            </div>
          </div>

          <div className={styles.testimonialCard}>
            <div className={styles.quote}>"</div>
            <p className={styles.testimonialText}>
              The personalized learning path was exactly what I needed. Free resources, 
              flexible schedule, and clear goals made the transition smooth.
            </p>
            <div className={styles.testimonialAuthor}>
              <div className={styles.authorAvatar}>MR</div>
              <div>
                <p className={styles.authorName}>Michael Rodriguez</p>
                <p className={styles.authorTitle}>Equipment Operator → HVAC Technician</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className={styles.stats}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users size={32} />
            </div>
            <div className={styles.statNumber}>5,000+</div>
            <div className={styles.statLabel}>Career Transitions</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <TrendingUp size={32} />
            </div>
            <div className={styles.statNumber}>92%</div>
            <div className={styles.statLabel}>Job Placement Rate</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <BookOpen size={32} />
            </div>
            <div className={styles.statNumber}>100+</div>
            <div className={styles.statLabel}>Career Paths Available</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Shield size={32} />
            </div>
            <div className={styles.statNumber}>100%</div>
            <div className={styles.statLabel}>Free & Secure</div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Start Your Career Transformation?</h2>
          <p className={styles.ctaText}>
            Join thousands of workers who have successfully transitioned to new, fulfilling careers.
          </p>
          <Button className={styles.ctaButton} onClick={() => navigate('/signup')}>
            Get Started for Free
            <ArrowRight size={20} />
          </Button>
          <p className={styles.ctaSubtext}>No credit card required • Takes less than 2 minutes</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Logo variant="full" className={styles.footerLogo} />
              <p className={styles.footerText}>
                Empowering displaced workers with AI-driven career transition support.
                Built with care for those seeking new opportunities.
              </p>
            </div>
            <div className={styles.footerLinks}>
              <h4>Platform</h4>
              <ul>
                <li onClick={() => navigate('/assessment')}>Skill Assessment</li>
                <li onClick={() => navigate('/careers')}>Career Matching</li>
                <li onClick={() => navigate('/learning')}>Learning Paths</li>
                <li onClick={() => navigate('/dashboard')}>Dashboard</li>
              </ul>
            </div>
            <div className={styles.footerLinks}>
              <h4>Resources</h4>
              <ul>
                <li>About Us</li>
                <li>How It Works</li>
                <li>Success Stories</li>
                <li>FAQs</li>
              </ul>
            </div>
            <div className={styles.footerLinks}>
              <h4>Legal</h4>
              <ul>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>
          <div className={styles.copyright}>
            <p>© 2025 SkillBridge. All rights reserved.</p>
            <p>Built with ❤️ for workers in transition</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
