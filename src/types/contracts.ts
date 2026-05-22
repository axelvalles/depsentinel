export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";
export type Framework = "expo" | "nextjs" | "react" | "vue" | "angular" | "svelte" | "node" | "unknown";
export type Severity = "low" | "medium" | "high" | "critical";

export interface DetectionFacts {
  rootDir: string;
  packageManager: PackageManager;
  lockfile: string | null;
  isWorkspace: boolean;
  framework: Framework;
  dependencies: Record<string, string>;
}

export interface PolicyRule {
  id: string;
  description: string;
  severity: Severity;
  evaluate: (facts: DetectionFacts) => Finding | null;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  meta?: Record<string, string | number | boolean>;
}

export interface ScanResult {
  risk_score: number;
  findings: Finding[];
  proposed_diff: string[];
  remediation_commands: string[];
}

export interface ScanEnvelope {
  schemaVersion: "1.0.0";
  command: "scan";
  facts: DetectionFacts;
  result: ScanResult;
}

export type InitPreset = "base" | "expo";

export interface InitFilePlan {
  path: string;
  status: "create" | "update" | "noop";
  backupPath?: string;
}

export interface InitResult {
  preset: InitPreset;
  dryRun: boolean;
  files: InitFilePlan[];
}

export interface InitEnvelope {
  schemaVersion: "1.0.0";
  command: "init";
  result: InitResult;
}

export interface CiResult {
  risk_score: number;
  proposed_diff: string[];
  remediation_commands: string[];
  findings: Finding[];
  failed_critical_policy: boolean;
  diagnostics: string[];
}

export interface CiEnvelope {
  schemaVersion: "1.0.0";
  command: "ci";
  facts: DetectionFacts;
  result: CiResult;
}

// --- M2 Install Guard Contracts ---

export type InstallDecision = "allow" | "warn" | "block";

export type AdapterStatus = "executed" | "skipped" | "failed";

export interface AdapterReport {
  tool: string;
  status: AdapterStatus;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface InstallOptions {
  packageName: string;
  cwd?: string;
  force?: boolean;
  json?: boolean;
  manager?: PackageManager;
}

export interface InstallResult {
  decision: InstallDecision;
  forced: boolean;
  score: number;
  findings: Finding[];
  remediationCommands: string[];
  adapterReport: AdapterReport[];
  installed: boolean;
  managerCommand?: string;
  exitCode: number;
}

export interface InstallEnvelope {
  schemaVersion: "1.0.0";
  command: "install";
  facts: DetectionFacts;
  result: InstallResult;
}

// --- M3 Doctor Contracts ---

export interface DoctorDiagnosis {
  id: string;
  category: "config" | "ci" | "dependencies" | "maintainer";
  severity: Severity;
  status: "pass" | "fail" | "skipped";
  title: string;
  detail: string;
  remediation: string;
  automated: boolean;
}

export interface DoctorResult {
  risk_score: number;
  diagnoses: DoctorDiagnosis[];
  passed: number;
  failed: number;
  skipped: number;
}

export interface DoctorEnvelope {
  schemaVersion: "1.0.0";
  command: "doctor";
  facts: DetectionFacts;
  result: DoctorResult;
}
