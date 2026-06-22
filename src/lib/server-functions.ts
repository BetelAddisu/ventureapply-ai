/**
 * Server Functions Registry
 * 
 * This file imports all server functions to ensure they are registered
 * with the TanStack Start server bundle. Import this file in any route
 * component that uses server functions, or in the app entry point.
 */

// CV Functions
export { tailorCV, parseCV, listCVs } from "./cv.functions";

// CV Extraction
export { extractSearchProfileFromCV } from "./cv-extract.functions";

// Job Functions
export { fetchJobs, scrapeJob, autoApply } from "./jobs.functions";

// Match Functions  
export { matchJobsToCV } from "./match.functions";

// Agent Functions
export { 
  getAgentProfile, 
  setAgentActive, 
  listApplications, 
  listAgentLogs, 
  runAgentSequence 
} from "./agent.functions";

// Trial Functions
export { getTrialStatus, expireTrialIfNeeded } from "./trial.functions";

// Example Functions
export { getGreeting } from "./api/example.functions";
