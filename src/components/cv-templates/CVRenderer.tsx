import React from "react";
import type { ResumeData, TemplateId } from "./types";
import { MinimalistTheme } from "./MinimalistTheme";
import { CreativeTheme } from "./CreativeTheme";
import { ExecutiveTheme } from "./ExecutiveTheme";

export interface CVRendererProps {
  /** Template identifier */
  templateId: TemplateId;
  /** Resume data following JSON Resume schema */
  resumeData: ResumeData;
}

/**
 * CVRenderer - Central dispatcher component for switching CV templates
 * 
 * Renders the appropriate template component based on templateId prop.
 * No external API calls or loading states - renders instantly.
 */
export function CVRenderer({ templateId, resumeData }: CVRendererProps) {
  switch (templateId) {
    case "minimalist":
      return <MinimalistTheme data={resumeData} />;
    case "creative":
      return <CreativeTheme data={resumeData} />;
    case "executive":
      return <ExecutiveTheme data={resumeData} />;
    default:
      // Fallback to minimalist for unknown template IDs
      console.warn(`Unknown templateId "${templateId}", falling back to minimalist`);
      return <MinimalistTheme data={resumeData} />;
  }
}

export default CVRenderer;
