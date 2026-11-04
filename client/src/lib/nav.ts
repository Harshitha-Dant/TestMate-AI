import {
  Brain,
  Bug,
  ChartColumn,
  FolderKanban,
  GitCompareArrows,
  History,
  Languages,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** One-line summary of what the module does. */
  summary: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, summary: "Quality score and live analytics." },
      { path: "/projects", label: "Projects", icon: FolderKanban, summary: "Create, switch and delete projects." },
    ],
  },
  {
    title: "Labs",
    items: [
      { path: "/chatbot", label: "Chatbot Lab", icon: MessageSquareText, summary: "Single-turn Q&A cases with rule-based checks." },
      { path: "/memory", label: "Memory Lab", icon: Brain, summary: "Multi-turn scripts that catch context loss." },
      { path: "/multilingual", label: "Multilingual", icon: Languages, summary: "English, Telugu, Tanglish and Hindi tests." },
      { path: "/api-studio", label: "API Studio", icon: Network, summary: "Send requests and assert on responses." },
    ],
  },
  {
    title: "Quality",
    items: [
      { path: "/regression", label: "Regression", icon: GitCompareArrows, summary: "Snapshot suites and diff runs." },
      { path: "/bugs", label: "Bugs", icon: Bug, summary: "Track failures from report to resolution." },
      { path: "/reports", label: "Reports", icon: ChartColumn, summary: "Pass rates and CSV/PDF exports." },
      { path: "/history", label: "Test History", icon: History, summary: "Search and reopen every past run." },
    ],
  },
  {
    title: "System",
    items: [{ path: "/settings", label: "Settings", icon: Settings, summary: "Thresholds, timeouts and preferences." }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
