import React from "react";
import type { ResumeData } from "./types";

interface CreativeThemeProps {
  data: ResumeData;
}

/**
 * CreativeTheme - Bold design with sidebar layout
 * - Left sidebar with contact/skills
 * - Main content area for experience
 * - Bold accent colors for creative roles
 */
export function CreativeTheme({ data }: CreativeThemeProps) {
  const { basics, work, education, skills, projects } = data;
  const { name = "", label = "", email = "", phone = "", url = "", summary = "", profiles = [] } = basics || {};

  return (
    <div className="creative-cv flex bg-white min-h-[297mm]">
      {/* Left Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6 flex-shrink-0">
        {/* Profile Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold leading-tight">{name || "Your Name"}</h1>
          {label && <p className="text-slate-300 mt-1 text-sm">{label}</p>}
        </div>

        {/* Contact Section */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-700 pb-1">
            Contact
          </h2>
          <div className="space-y-2 text-sm">
            {email && <div className="break-all">{email}</div>}
            {phone && <div>{phone}</div>}
            {url && <div className="break-all">{url}</div>}
            {profiles.map((profile, idx) => (
              <div key={idx} className="break-all">
                {profile.url || profile.username}
              </div>
            ))}
          </div>
        </div>

        {/* Skills Section */}
        {skills && skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-700 pb-1">
              Skills
            </h2>
            <div className="space-y-3">
              {skills.map((skill, idx) => {
                const skillName = typeof skill === 'string' ? skill : (skill.name || '');
                const skillLevel = typeof skill === 'string' ? '' : (skill.level || '');
                const skillKeywords = typeof skill === 'string' ? [] : (skill.keywords || []);
                return (
                  <div key={idx}>
                    <div className="text-sm font-medium">{skillName}</div>
                    {skillLevel && (
                      <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: getLevelWidth(skillLevel) }}
                        />
                      </div>
                    )}
                    {skillKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {skillKeywords.slice(0, 5).map((kw, kwIdx) => (
                          <span key={kwIdx} className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Education Sidebar */}
        {education && education.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-700 pb-1">
              Education
            </h2>
            {education.map((edu, idx) => (
              <div key={idx} className="mb-4 last:mb-0">
                <div className="text-sm font-medium">{edu.studyType || "Degree"}</div>
                {edu.area && <div className="text-xs text-slate-300">{edu.area}</div>}
                <div className="text-xs text-slate-400 mt-0.5">{edu.institution}</div>
                <div className="text-xs text-slate-500">{edu.endDate}</div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {/* Summary */}
        {summary && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b-2 border-amber-500 pb-1 mb-3 inline-block">
              Profile
            </h2>
            <p className="text-gray-700 leading-relaxed text-sm">{summary}</p>
          </section>
        )}

        {/* Experience */}
        {work && work.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b-2 border-amber-500 pb-1 mb-3 inline-block">
              Experience
            </h2>
            {work.map((job, idx) => (
              <div key={idx} className="mb-5 last:mb-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-gray-900">{job.position || job.name}</h3>
                  <span className="text-xs text-slate-500">
                    {job.startDate}{job.startDate && job.endDate ? " – " : ""}{job.endDate}
                  </span>
                </div>
                <p className="text-amber-600 text-sm font-medium">{job.company || job.name}</p>
                {job.summary && <p className="text-gray-600 mt-1 text-sm">{job.summary}</p>}
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {job.highlights.map((highlight, hIdx) => (
                      <li key={hIdx} className="text-sm text-gray-700 pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-amber-500">
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b-2 border-amber-500 pb-1 mb-3 inline-block">
              Projects
            </h2>
            <div className="grid gap-3">
              {projects.map((project, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">
                    {project.name}
                    {project.url && (
                      <a href={project.url} className="ml-2 text-xs text-amber-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    )}
                  </h3>
                  {project.description && <p className="text-gray-600 text-sm mt-1">{project.description}</p>}
                  {project.highlights && project.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.highlights.map((highlight, hIdx) => (
                        <span key={hIdx} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Convert skill level string to percentage width
 */
function getLevelWidth(level: string): string {
  const levelLower = level.toLowerCase();
  if (levelLower.includes("expert") || levelLower.includes("master")) return "100%";
  if (levelLower.includes("advanced") || levelLower.includes("senior")) return "80%";
  if (levelLower.includes("intermediate") || levelLower.includes("mid")) return "60%";
  if (levelLower.includes("beginner") || levelLower.includes("junior")) return "40%";
  if (levelLower.includes("novice")) return "20%";
  return "50%";
}

export default CreativeTheme;
