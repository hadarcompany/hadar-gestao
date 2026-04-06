import { type ChecklistItem } from "./task-templates";

export interface TaskData {
  id: string;
  title: string;
  type: string | null;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedTime: number | null;
  actualTime: number | null;
  checklist: ChecklistItem[] | null;
  extraFields: Record<string, unknown> | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  clientId: string | null;
  client: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  assignees: Array<{ user: { id: string; name: string } }>;
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
  contractStartDate: string | null;
  renewalDate: string | null;
  _count: { tasks: number };
  interactions: InteractionData[];
  accesses?: AccessData[];
  tasks?: TaskData[];
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
