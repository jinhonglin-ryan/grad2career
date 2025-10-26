# SkillBridge Frontend

AI-powered career transition platform helping displaced workers find new opportunities, assess skills, and build personalized learning paths.

## Features

- **Skill Assessment**: Conversational AI to identify transferable skills
- **Career Matching**: Match skills to careers with gap analysis
- **Learning Paths**: Personalized week-by-week training plans
- **Resource Discovery**: Curated free and affordable learning resources

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Ant Design
- Axios
- Lucide Icons

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- npm or pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your backend URL:
```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable components
│   ├── pages/             # Page components
│   │   ├── Home.tsx       # Landing page
│   │   ├── LoginPage.tsx  # Login
│   │   ├── SignUpPage.tsx # Sign up
│   │   ├── Dashboard.tsx  # User dashboard
│   │   ├── SkillAssessment.tsx  # Skill assessment chat
│   │   ├── CareerMatch.tsx      # Career matching
│   │   └── LearningPath.tsx     # Learning path planner
│   ├── context/           # React contexts
│   │   └── AuthContext.tsx
│   ├── services/          # API services
│   │   └── api.ts
│   ├── config/            # Configuration
│   │   └── api.ts
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── public/                # Static assets
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies
```

## Available Routes

- `/` - Landing page
- `/login` - Login page
- `/signup` - Sign up page
- `/dashboard` - User dashboard
- `/assessment` - Skill assessment (conversational AI)
- `/careers` - Career matching and gap analysis
- `/learning` - Personalized learning path

## Environment Variables

- `VITE_API_BASE_URL` - Backend API base URL

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT
