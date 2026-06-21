# VentureApply AI

An AI-powered job application platform that helps you build professional resumes, discover opportunities across multiple job boards, and streamline your application workflow.

## Architecture Overview

```mermaid
graph TB
    subgraph Frontend["🌐 Frontend (React + TypeScript)"]
        CVBuilder["🎨 CV Builder<br/>Interactive Editor"]
        JobTracker["🔍 Job Tracker<br/>Discovery & Matching"]
        ResumeVault["📊 Resume Vault<br/>Multi-Resume Storage"]
        Settings["⚙️ Settings<br/>Profile & Notifications"]
        AgentCommand["🤖 Agent Command<br/>AI Automation"]
    end

    subgraph Routing["🧭 TanStack Router"]
        RouteTree["Route Tree<br/>Type-Safe Routes"]
    end

    subgraph Backend["⚡ Nitro Server Functions"]
        JobsAPI["📡 Job Search API<br/>fetchJobs, matchJobs"]
        CVAPI["📝 CV Processing API<br/>parseCV, listCVs"]
        AuthAPI["🔐 Authentication<br/>requireSupabaseAuth"]
    end

    subgraph Database["🗄️ Supabase (PostgreSQL)"]
        Auth["👤 Auth<br/>User Management"]
        Profiles["👤 Profiles<br/>User Settings"]
        CVs["📄 CVs<br/>Resume Storage"]
        Jobs["💼 Scraped Jobs<br/>Job Listings"]
        Applications["📬 Applications<br/>Job Tracking"]
        AgentLogs["📜 Agent Logs<br/>Activity History"]
    end

    subgraph ExternalAPIs["🔌 External Services"]
        SerpAPI["🔎 SerpAPI<br/>Google Jobs Engine"]
        Jobicy["🌐 Jobicy<br/>Remote Jobs API"]
        Telegram["📱 Telegram Bot<br/>@VentureApply_AIBot"]
        Email["📧 Email Service<br/>Resend/SendGrid"]
    end

    subgraph AIProviders["🤖 AI Providers"]
        Gemini["✨ Gemini<br/>Primary Model"]
        Groq["⚡ Groq<br/>Fast Fallback"]
        OpenRouter["🌐 OpenRouter<br/>Multi-Provider"]
    end

    %% Connections
    Frontend --> Routing
    Routing --> Backend
    Backend --> Database
    Backend --> ExternalAPIs
    Backend --> AIProviders
    
    CVBuilder --> CVAPI
    CVBuilder --> JobsAPI
    JobTracker --> JobsAPI
    JobTracker --> Database
    ResumeVault --> Database
    Settings --> Profiles
    Settings --> Telegram
    AgentCommand --> AIProviders
    AgentCommand --> AgentLogs
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Server
    participant Database
    participant ExternalAPI

    User->>Frontend: Create/Edit Resume
    Frontend->>Server: Save CV (upsert)
    Server->>Database: Insert/Update CV
    Database-->>Server: Confirmation
    Server-->>Frontend: Success Toast

    User->>Frontend: Search Jobs
    Frontend->>Server: fetchJobs(query)
    Server->>SerpAPI: Search Google Jobs
    Server->>Jobicy: Search Remote Jobs
    SerpAPI-->>Server: Job Results
    Jobicy-->>Server: Job Results
    Server->>Server: Deduplicate & Merge
    Server->>Database: Store Jobs
    Database-->>Server: Saved Jobs
    Server-->>Frontend: Job Feed

    User->>Frontend: Match CV to Jobs
    Frontend->>Server: matchJobs(cv_id)
    Server->>AIProviders: Score with AI
    AIProviders-->>Server: Match Scores
    Server->>Database: Store Matches
    Server-->>Frontend: Ranked Jobs

    User->>Frontend: Enable Notifications
    Frontend->>Database: Save Preferences
    Database-->>Frontend: Preferences Saved
    Server->>Telegram: Send Job Alert
```

## Features

### 🎨 CV Builder
- **Interactive Resume Editor** - Create and customize professional resumes with live preview
- **Multiple Templates** - Choose from Minimalist, Creative, and Executive styles
- **Inline Renaming** - Real-time resume naming with auto-save (500ms debounce)
- **File Import** - Upload PDF or TXT files and let AI structure your CV
- **PDF Export** - Export polished resumes with iframe-based rendering (no CSS inheritance issues)

### 🔍 Job Discovery & Tracking
- **Dual Job Search** - Searches both SerpAPI (Google Jobs) and Jobicy in parallel
- **Smart Deduplication** - Removes duplicate listings across sources
- **Location Filtering** - Filter by Remote, Hybrid, On-site, or Any location
- **Live Feed** - Always see results immediately, even for previously searched keywords
- **Job Matching** - Score your CV against discovered jobs

### 📊 Resume Vault
- **Multi-Resume Management** - Store and manage multiple resume versions
- **Template Preview** - Preview any resume with different templates
- **Quick Export** - Export any saved resume to PDF instantly

### ⚙️ Settings & Notifications
- **Profile Management** - Editable personal information (name, phone, title, summary, location)
- **Multi-Channel Notifications** - Email, Telegram, and WhatsApp alerts
- **Telegram Bot Integration** - Get job alerts via @VentureApply_AIBot

### 🤖 Agent Command
- **AI Agent** - Automated job application assistance

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React, TypeScript, TanStack Router |
| **Backend** | Nitro/Start Server Functions |
| **Database** | Supabase (PostgreSQL) |
| **AI/ML** | Google Gemini, Groq, OpenRouter (fallback) |
| **Job APIs** | SerpAPI, Jobicy |
| **UI** | shadcn/ui, Tailwind CSS, Lucide Icons |
| **Notifications** | Telegram Bot API |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- API keys (see below)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers (at least one required)
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Job Discovery
SERPAPI_KEY=your_serpapi_key
```

### Installation

```bash
# Clone the repository
git clone https://github.com/BetelAddisu/ventureapply-ai.git
cd ventureapply-ai

# Install dependencies
npm install

# Run development server
npm run dev
```

### Database Setup

Run the Supabase migrations to set up the required tables:

```bash
# Apply migrations (using Supabase CLI or manual SQL execution)
supabase db push
```

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
ventureapply-ai/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── app-sidebar.tsx  # Main navigation sidebar
│   │   └── cv-templates/     # Resume template renderers
│   ├── hooks/               # Custom React hooks
│   │   └── use-cv-cache.ts  # CV data caching
│   ├── integrations/        # Third-party integrations
│   │   └── supabase/       # Supabase client & auth
│   ├── lib/                 # Core utilities & server functions
│   │   ├── jobs.functions.ts    # Job search & matching
│   │   ├── cv.functions.ts      # CV parsing & listing
│   │   ├── cv-extract.functions.ts # Profile extraction
│   │   └── notification.functions.ts # Multi-channel notifications
│   └── routes/              # Page routes
│       └── _authenticated/  # Protected dashboard routes
│           ├── dashboard.tsx        # Main dashboard
│           ├── dashboard.cv-builder.tsx  # CV Builder
│           ├── dashboard.jobs.tsx   # Job Tracker
│           ├── dashboard.settings.tsx    # Settings
│           └── dashboard.resumes.tsx     # Resume Vault
├── supabase/
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## API Reference

### Job Search (`/api/search`)
Fetches jobs from SerpAPI and Jobicy, merges results, and stores in database.

**Request:**
```typescript
{
  target_role?: string;      // Job search keyword
  location_type?: "any" | "remote" | "hybrid" | "onsite";
}
```

**Response:**
```typescript
{
  inserted: number;          // Number of new jobs saved
  total_found: number;       // Total jobs found
  message: string;           // Human-readable status
  used_cv_fallback: boolean; // Whether CV profile was used
}
```

### CV Parsing (`/api/parse-cv`)
Extracts structured CV data from raw text using AI.

### Notifications
Multi-channel notification system supporting:
- Email (via Resend/SendGrid)
- Telegram (via @VentureApply_AIBot)
- WhatsApp

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Acknowledgments

- [TanStack](https://tanstack.com/) - Routing and data management
- [Supabase](https://supabase.com/) - Database and authentication
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [SerpAPI](https://serpapi.com/) - Google Jobs data
- [Jobicy](https://jobicy.com/) - Remote job listings
