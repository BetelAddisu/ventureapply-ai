/**
 * JSON Resume Standard Schema Types
 * @see https://jsonresume.org/schema/
 */

export interface ResumeProfile {
  network: string;
  username: string;
  url: string;
}

export interface ResumeBasics {
  name: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: {
    address?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    region?: string;
  };
  profiles?: ResumeProfile[];
}

export interface ResumeWork {
  name?: string;
  company?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface ResumeEducation {
  institution?: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface ResumeSkill {
  name?: string;
  level?: string;
  keywords?: string[];
}

export interface ResumeProject {
  name?: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface ResumeReference {
  name?: string;
  description?: string;
  institution?: string;
}

export interface ResumeInterest {
  name?: string;
  keywords?: string[];
}

export interface ResumeLanguage {
  language?: string;
  fluency?: string;
}

export interface ResumeCertificate {
  name?: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface ResumePublication {
  name?: string;
  publisher?: string;
  releaseDate?: string;
  website?: string;
  summary?: string;
}

/**
 * Full JSON Resume document structure
 */
export interface ResumeData {
  basics?: ResumeBasics;
  work?: ResumeWork[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  projects?: ResumeProject[];
  publications?: ResumePublication[];
  certificates?: ResumeCertificate[];
  interests?: ResumeInterest[];
  languages?: ResumeLanguage[];
  references?: ResumeReference[];
  meta?: {
    canonical?: string;
    version?: string;
    lastModified?: string;
    origin?: string;
  };
}

/**
 * Internal CV Builder format (used in dashboard.cv-builder.tsx)
 * This is converted to ResumeData for theme rendering
 */
export interface CVBuilderData {
  profile: {
    name: string;
    title: string;
    email: string;
    phone: string;
    summary: string;
  };
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    bullets: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  skills: string;
}

/**
 * Convert CVBuilderData to ResumeData for theme rendering
 */
export function cvBuilderToResumeData(cv: CVBuilderData): ResumeData {
  return {
    basics: {
      name: cv.profile.name,
      label: cv.profile.title,
      email: cv.profile.email,
      phone: cv.profile.phone,
      summary: cv.profile.summary,
    },
    work: cv.experiences
      .filter((e) => e.role || e.company)
      .map((e) => ({
        company: e.company,
        position: e.role,
        startDate: e.period.split(" - ")[0] || "",
        endDate: e.period.split(" - ")[1] || "",
        highlights: e.bullets ? e.bullets.split("\n").filter(Boolean) : [],
      })),
    education: cv.education
      .filter((e) => e.degree || e.school)
      .map((e) => ({
        institution: e.school,
        studyType: e.degree,
        endDate: e.year,
      })),
    skills: cv.skills
      ? cv.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name }))
      : [],
    projects: [],
  };
}

export type TemplateId = "minimalist" | "creative" | "executive";
