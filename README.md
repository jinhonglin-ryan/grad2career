# SkillBridge - AI-Powered Career Transition Platform

SkillBridge is an AI-driven platform designed to help displaced workers transition to new careers. It provides conversational skill assessment, intelligent career matching, and personalized learning paths to bridge skill gaps.

## 🎯 Project Overview

SkillBridge addresses the challenge of career transitions for displaced workers by:
- **Identifying transferable skills** through conversational AI
- **Matching skills to careers** with detailed gap analysis
- **Providing learning paths** with curated, affordable resources
- **Tracking progress** toward career goals

## 🏗️ Architecture

### Backend (FastAPI + Python)

The backend integrates four modular AI components:

1. **Conversational Skill Assessment Module**
   - Uses LLM APIs (e.g., OpenAI) for structured dialogues
   - Extracts and normalizes skills against O*NET taxonomies
   - Built with prompt engineering and few-shot learning

2. **Skill Gap Analysis Module**
   - Uses Sentence-BERT for semantic similarity
   - Compares user skills with job requirements
   - Generates interpretable "gap maps"

3. **Learning Resource Retrieval Module**
   - Hybrid search with keyword filtering + semantic ranking
   - Sources from YouTube, Coursera, edX, etc.
   - Ranks by relevance, cost, and accessibility

4. **Learning Path Generation Module**
   - Algorithmic constraint-satisfaction planning
   - Week-by-week schedules respecting time/budget
   - Transparent and modifiable plans

**Tech Stack:**
- FastAPI
- Supabase (PostgreSQL)
- OpenAI API / LLM integration
- Sentence-BERT embeddings

### Frontend (React + TypeScript)

Modern, responsive web application with:

- **Landing Page** - Product introduction
- **Skill Assessment** - Interactive chat interface
- **Career Matching** - Visual career cards with match scores
- **Learning Path** - Week-by-week timeline with resources
- **Dashboard** - User overview and quick actions

**Tech Stack:**
- React 18 + TypeScript
- Vite
- React Router v7
- Ant Design + Lucide Icons
- Axios
- CSS Modules

## 📂 Project Structure

```
grad2career/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core config (Supabase, settings)
│   │   ├── db/             # Database models and schemas
│   │   ├── services/       # AI service modules
│   │   └── utils/          # Utility functions
│   ├── requirements.txt    # Python dependencies
│   └── README.md
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React contexts
│   │   ├── services/       # API services
│   │   └── config/         # Configuration
│   ├── package.json        # Node dependencies
│   └── README.md
│
├── FRONTEND_SETUP.md       # Frontend setup guide
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- **Backend:** Python 3.9+
- **Frontend:** Node.js 14+, npm
- **Database:** Supabase account (or PostgreSQL)
- **AI Services:** OpenAI API key (optional for development)

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Optional: Google OAuth (required only if using Google sign-in)
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
EOF

# Run server
uvicorn app.main:app --reload
```

Backend will run on `http://127.0.0.1:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env

# Run development server
npm run dev
```

Frontend will run on `http://localhost:5173`

## 📋 Features

### ✅ Implemented

- [x] Landing page with modern UI
- [x] User authentication (login/signup)
- [x] Skill assessment chat interface
- [x] Career matching with gap analysis
- [x] Learning path visualization
- [x] User dashboard
- [x] Responsive design

### 🔄 In Progress / Planned

- [ ] Backend AI integration (LLM for skill extraction)
- [ ] Real-time skill profile updates
- [ ] Learning resource API integration
- [ ] Progress tracking and analytics
- [ ] Resume upload and parsing
- [ ] Mobile app version

## 🎨 Design System

### Color Palette

- **Primary:** Purple gradient (#667eea to #764ba2)
- **Success:** Green (#10b981)
- **Warning:** Yellow (#f59e0b)
- **Error:** Red (#ef4444)
- **Neutral:** Grays (#f9fafb to #1f2937)

### Typography

- **Headings:** Bold, sans-serif
- **Body:** Regular, sans-serif
- **Code:** Monospace

## 🔌 API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Skills
- `POST /skills/assess` - Conversational skill assessment
- `GET /skills/profile` - Get user skill profile

### Careers
- `GET /careers/match` - Get matched careers
- `GET /careers/recommendations` - Career recommendations

### Learning
- `POST /learning/path` - Generate learning path
- `GET /learning/resources` - Get learning resources

### User
- `GET /user/profile` - Get user profile
- `GET /user/dashboard` - Get dashboard data

## 📊 Data Sources

1. **User-Provided Data**
   - Skills, experience, certifications
   - Gathered through conversational interface
   - Normalized against O*NET taxonomies

2. **Labor Market Data**
   - BLS statistics
   - Indeed API
   - Job posting data (30-50 per career)

3. **Learning Resources**
   - Coursera, edX, YouTube
   - State workforce registries
   - Free and paid options

## 🧪 Testing

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Backend

```bash
cd backend
pytest
```

## 🚢 Deployment

### Frontend (Vercel)

```bash
cd frontend
npm run build
vercel --prod
```

### Backend (Render/Railway)

1. Connect your Git repository
2. Set environment variables
3. Deploy with:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Team

Developed as part of a graduate capstone project focused on AI-powered career transition solutions.

## 🙏 Acknowledgments

- O*NET for skill taxonomies
- U.S. Bureau of Labor Statistics for job data
- Open-source learning platforms (Coursera, edX, YouTube)
- OpenAI for LLM capabilities

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for displaced workers seeking new opportunities**

