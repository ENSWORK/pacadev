import { create } from 'zustand';
import { UserRole, ClientData } from './types';

export type AppView = 'dashboard' | 'clients' | 'workspace' | 'pipeline' | 'ai' | 'backup' | 'observability' | 'audit';
export type ClientTab = 'fiche' | 'modules' | 'branches' | 'tickets' | 'versions';
export type WorkspaceTab = 'tickets' | 'workstarter' | 'workflow';

export interface RealPipeline {
  id: string;
  clientId: string;
  clientSlug: string;
  commitHash: string | null;
  branch: string | null;
  trigger: string | null;
  status: string;
  conclusion: string | null;
  lintStatus: string;
  testsStatus: string;
  securityStatus: string;
  aiRiskStatus: string;
  deployStatus: string;
  duration: number | null;
  url: string | null;
  createdAt: string;
}

export interface RealTicket {
  id: number;
  title: string;
  status: 'open' | 'closed' | 'in_progress';
  assignee: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url?: string;
  body?: string;
  client?: string;
}

interface AppState {
  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Client Space
  selectedClientSlug: string | null;
  setSelectedClientSlug: (slug: string | null) => void;
  clientTab: ClientTab;
  setClientTab: (tab: ClientTab) => void;

  // Workspace
  workspaceTab: WorkspaceTab;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  selectedTicketId: number | null;
  setSelectedTicketId: (id: number | null) => void;

  // User
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  ticketCreatorOpen: boolean;
  setTicketCreatorOpen: (open: boolean) => void;

  // Real-time
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Notifications
  unreadAlerts: number;
  setUnreadAlerts: (count: number) => void;

  // Real data (loaded from API, replaces mock data)
  realClients: ClientData[];
  realTickets: Record<string, RealTicket[]>;
  realPipelines: RealPipeline[];
  dataLoaded: boolean;
  setRealClients: (clients: ClientData[]) => void;
  setRealTickets: (tickets: Record<string, RealTicket[]>) => void;
  setRealPipelines: (pipelines: RealPipeline[]) => void;
  setDataLoaded: (loaded: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  
  selectedClientSlug: null,
  setSelectedClientSlug: (slug) => set({ selectedClientSlug: slug, currentView: 'clients' }),
  clientTab: 'fiche',
  setClientTab: (tab) => set({ clientTab: tab }),

  workspaceTab: 'tickets',
  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  selectedTicketId: null,
  setSelectedTicketId: (id) => set({ selectedTicketId: id }),
  
  userRole: 'admin',
  setUserRole: (role) => set({ userRole: role }),
  
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  ticketCreatorOpen: false,
  setTicketCreatorOpen: (open) => set({ ticketCreatorOpen: open }),
  
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  unreadAlerts: 3,
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),

  realClients: [],
  realTickets: {},
  realPipelines: [],
  dataLoaded: false,
  setRealClients: (clients) => set({ realClients: clients }),
  setRealTickets: (tickets) => set({ realTickets: tickets }),
  setRealPipelines: (pipelines) => set({ realPipelines: pipelines }),
  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),
}));
