export interface Project {
  id: number;
  name: string;
  description: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  suites: number;
  testCases: number;
  executions: number;
  openBugs: number;
}

export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

export interface ProjectInput {
  name: string;
  description?: string;
}
