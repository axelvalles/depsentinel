import type { DetectionFacts } from "../types/contracts.js";

export interface CriticalAdvisoryMatch {
  packageName: string;
  affectedVersion: string;
  advisoryId: string;
  title: string;
}

export interface AdvisorySource {
  findCriticalMatch: (facts: DetectionFacts) => CriticalAdvisoryMatch | null;
}
