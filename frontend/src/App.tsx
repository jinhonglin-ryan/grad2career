import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Dashboard from './pages/Dashboard';
import SkillAssessment from './pages/SkillAssessment';
import CareerMatch from './pages/CareerMatch';
import LearningPath from './pages/LearningPath';
import VideoDetail from './pages/VideoDetail';
import OAuthCallback from './pages/OAuthCallback';
import OnboardingPage from './pages/OnboardingPage';
import Profile from './pages/Profile';
import 'antd/dist/reset.css';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/assessment" element={<SkillAssessment />} />
      <Route path="/careers" element={<CareerMatch />} />
      <Route path="/learning" element={<LearningPath />} />
      <Route path="/learning/video/:videoId" element={<VideoDetail />} />
    </Routes>
  );
}

export default App;
