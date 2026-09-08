export type AccountLead = {
  id: string;
  name: string;
  initials: string;
};

export type ManagedClient = {
  id: string;
  name: string;
  accountLeadId: string | null;
  accountLeadName: string | null;
  isActive: boolean;
};

export type ClientManagementData = {
  clients: ManagedClient[];
  accountLeads: AccountLead[];
};
