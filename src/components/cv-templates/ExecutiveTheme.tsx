import React from "react";
import type { ResumeData } from "./types";

interface ExecutiveThemeProps {
  data: ResumeData;
}

/**
 * ExecutiveTheme - Traditional professional layout
 * - Serif fonts for elegance
 * - Elegant line dividers
 * - Structured rows for classic professional roles
 */
export function ExecutiveTheme({ data }: ExecutiveThemeProps) {
  const { basics, work, education, skills, projects } = data;
  const { name = "", label = "", email = "", phone = "", url = "", summary = "", profiles = [] } = basics || {};

  return (
    <div className="executive-cv font-serif text-gray-800 bg-white">
      {/* Header */}
      <header className="text-center border-b-2 border-gray-800 pb-6 mb-6">
        <h1 className="text-4xl font-bold tracking-wide">{name || "Your Name"}</h1>
        {label && <p className="text-lg text-gray-600 mt-2 italic">{label}</p>}
        
        <div className="flex justify-center items-center gap-4 mt-4 text-sm text-gray-700">
          {email && <span>{email}</span>}
          <span className="text-gray-400">|</span>
          {phone && <span>{phone}</span>}
          {url && (
            <>
              <span className="text-gray-400">|</span>
              <span>{url}</span>
            </>
          )}
        </div>
        
        {profiles && profiles.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-2 text-sm text-gray-600">
            {profiles.map((profile, idx) => (
              <span key={idx}>
                {profile.network}: {profile.url || profile.username}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Summary */}
      {summary && (
        <section className="mb-8 text-center">
          <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto">
            {summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {work && work.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Professional Experience" />
          {work.map((job, idx) => (
            <div key={idx} className="mb-6 last:mb-0">
              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 mb-3">
                <div>
                  <h3 className="text-lg font-bold">{job.position || job.name}</h3>
                  <p className="text-gray-600 italic">{job.company || job.name}</p>
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {job.startDate}{job.startDate && job.endDate ? " – " : ""}{job.endDate || "Present"}
                </span>
              </div>
              {job.summary && (
                <p className="text-gray-700 mb-3 leading-relaxed">{job.summary}</p>
              )}
              {job.highlights && job.highlights.length > 0 && (
                <ul className="space-y-1">
                  {job.highlights.map((highlight, hIdx) => (
                    <li key={hIdx} className="text-gray-700 text-sm pl-5 relative before:content-['▪'] before:absolute before:left-0 before:text-gray-400">
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Two Column Layout for Education and Skills */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Education */}
        {education && education.length > 0 && (
          <section>
            <SectionHeader title="Education" />
            {education.map((edu, idx) => (
              <div key={idx} className="mb-4 last:mb-0">
                <h3 className="font-bold text-gray-900">
                  {edu.studyType || "Degree"}{edu.area ? ` in ${edu.area}` : ""}
                </h3>
                <p className="text-gray-600 italic text-sm">{edu.institution}</p>
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>{edu.endDate}</span>
                  {edu.score && <span>GPA: {edu.score}</span>}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Skills */}
        {skills && skills.length > 0 && (
          <section>
            <SectionHeader title="Core Competencies" />
            <div className="space-y-2">
              {skills.map((skill, idx) => {
                const skillName = typeof skill === 'string' ? skill : (skill.name || '');
                const skillLevel = typeof skill === 'string' ? '' : (skill.level || '');
                const skillKeywords = typeof skill === 'string' ? [] : (skill.keywords || []);
                return (
                  <div key={idx} className="text-sm">
                    <span className="font-semibold text-gray-900">{skillName}</span>
                    {skillLevel && (
                      <span className="text-gray-500 ml-2">({skillLevel})</span>
                    )}
                    {skillKeywords.length > 0 && (
                      <div className="text-gray-600 text-xs mt-0.5">
                        {skillKeywords.join(" • ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Projects */}
      {projects && projects.length > 0 && (
        <section>
          <SectionHeader title="Notable Projects" />
          {projects.map((project, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <div className="flex justify-between items-baseline border-b border-gray-200 pb-1 mb-2">
                <h3 className="font-bold text-gray-900">
                  {project.name}
                  {project.url && (
                    <a href={project.url} className="ml-2 text-xs text-gray-500 hover:text-gray-700 underline" target="_blank" rel="noopener noreferrer">
                      {project.url}
                    </a>
                  )}
                </h3>
                {(project.startDate || project.endDate) && (
                  <span className="text-xs text-gray-500">
                    {project.startDate}{project.startDate && project.endDate ? " – " : ""}{project.endDate}
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-gray-700 text-sm mb-2">{project.description}</p>
              )}
              {project.highlights && project.highlights.length > 0 && (
                <ul className="space-y-1">
                  {project.highlights.map((highlight, hIdx) => (
                    <li key={hIdx} className="text-gray-700 text-sm pl-5 relative before:content-['▪'] before:absolute before:left-0 before:text-gray-400">
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

/**
 * Reusable section header with elegant divider
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-bold text-gray-900 border-b-2 border-gray-800 pb-1 mb-4 uppercase tracking-wider">
      {title}
    </h2>
  );
}

export default ExecutiveTheme;
