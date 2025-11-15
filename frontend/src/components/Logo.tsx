import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoFull from '../assets/skillbridge_logo_titled.svg';
import logoIcon from '../assets/skillbridge_logo.svg';
import styles from './Logo.module.css';

interface LogoProps {
  variant?: 'full' | 'icon';
  onClick?: () => void;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ variant = 'full', onClick, className }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/');
    }
  };

  return (
    <div 
      className={`${styles.logo} ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {variant === 'full' ? (
        <img 
          src={logoFull} 
          alt="SkillBridge" 
          className={styles.logoFull}
        />
      ) : (
        <img 
          src={logoIcon} 
          alt="SkillBridge" 
          className={styles.logoIcon}
        />
      )}
    </div>
  );
};

export default Logo;




