import React from "react";
import type { ResumeData } from "./types";

interface MinimalistThemeProps {
  data: ResumeData;
}

/**
 * MinimalistTheme - Clean layout optimized for ATS readability
 * - Standard typography
 * - Clear section hierarchy
 * - High contrast for scanning
 */
export function MinimalistTheme({ data }: MinimalistThemeProps) {
  const { basics, work, education, skills, projects } = data;
  const { name = "", label = "", email = "", phone = "", url = "", summary = "", profiles = [] } = basics || {};

  return (
    <div className="minimalist-cv font-sans text-sm text-gray-900 bg-white">
      {/* Header */}
      <header className="border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{name || "Your Name"}</h1>
        {label && <p className="text-lg text-gray-600 mt-1">{label}</p>}
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-700">
          {email && <span>{email}</span>}
          {phone && <span>{phone}</span>}
          {url && <span>{url}</span>}
          {profiles.map((profile, idx) => (
            <span key={idx}>{profile.url || profile.username}</span>
          ))}
        </div>
      </header>

      {/* Summary */}
      {summary && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Summary</h2>
          <p className="text-gray-700 leading-relaxed">{summary}</p>
        </section>
      )}

      {/* Experience */}
      {work && work.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">
            Experience
          </h2>
          {work.map((job, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold text-gray-900">{job.position || job.name}</h3>
                <span className="text-xs text-gray-500">
                  {job.startDate}{job.startDate && job.endDate ? " – " : ""}{job.endDate}
                </span>
              </div>
              <p className="text-gray-600 text-sm">{job.company || job.name}</p>
              {job.summary && <p className="text-gray-700 mt-1 text-sm">{job.summary}</p>}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {job.highlights.map((highlight, hIdx) => (
                    <li key={hIdx} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {education && education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">
            Education
          </h2>
          {education.map((edu, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold text-gray-900">
                  {edu.studyType || "Degree"}{edu.area ? ` in ${edu.area}` : ""}
                </h3>
                <span className="text-xs text-gray-500">{edu.endDate}</span>
              </div>
              <p className="text-gray-600 text-sm">
                {edu.institution}{edu.score ? ` • ${edu.score}` : ""}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => {
              const skillName = typeof skill === 'string' ? skill : (skill.name || '');
              const skillLevel = typeof skill === 'string' ? '' : (skill.level || '');
              return (
                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {skillName}
                  {skillLevel && <span className="text-gray-500 ml-1">({skillLevel})</span>}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Projects */}
      {projects && projects.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">
            Projects
          </h2>
          {projects.map((project, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <h3 className="font-semibold text-gray-900">
                {project.name}
                {project.url && (
                  <a href={project.url} className="ml-2 text-xs text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    Link
                  </a>
                )}
              </h3>
              {project.description && <p className="text-gray-700 text-sm mt-1">{project.description}</p>}
              {project.highlights && project.highlights.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {project.highlights.map((highlight, hIdx) => (
                    <li key={hIdx} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default MinimalistTheme;
