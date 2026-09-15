import { type ChecklistItem } from "./task-templates";

export interface UserSummary {
  id: string;
  name: string;
  image?: string | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface TaskAttachmentData {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export interface TaskData {
  id: string;
  title: string;
  type: string | null;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  publishDate: string | null;
  completedAt: string | null;
  isExtra: boolean;
  estimatedTime: number | null;
  actualTime: number | null;
  checklist: ChecklistItem[] | null;
  extraFields: Record<string, unknown> | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  clientId: string | null;
  client: ClientSummary | null;
  area: string | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  labelIds: string[];
  _count?: { updates: number };
  createdBy: { id: string; name: string };
  assignees: Array<{ user: UserSummary }>;
  attachments?: TaskAttachmentData[];
}

export interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  driveLink: string | null;
  contractLink: string | null;
  briefing: string | null;
  status: string;
  classification: "MRR" | "FREELA" | null;
  contractStartDate: string | null;
  renewalDate: string | null;
  brandColors?: string[];
  brandFontPrimary?: string | null;
  brandFontSecondary?: string | null;
  logoUrl?: string | null;
  _count: { tasks: number };
  interactions: InteractionData[];
  accesses?: AccessData[];
  tasks?: TaskData[];
  services?: Array<{ id: string; type: string; name: string | null }>;
}

export interface InteractionData {
  id: string;
  type: string;
  content: string;
  date: string;
  author: { id: string; name: string };
}

export interface AccessData {
  id: string;
  platform: string;
  url: string | null;
  email: string | null;
  password: string | null;
  observations: string | null;
  clientId: string;
  client: { id: string; name: string };
}
