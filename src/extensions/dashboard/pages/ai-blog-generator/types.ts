export type MemberRow = {
  memberId: string;
  name: string;
  email: string | null;
  status: string;
  activityStatus: string;
  privacyStatus: string;
  approved: boolean | null;
};

export type Credits = {
  periodicCredits: { balance: number; cap: number | null };
  topUpCredits: { balance: number; cap: number | null };
  totalAvailable: number;
  walletScope: string;
  checkedAt: string;
};

export type WixBlogStatus = {
  installed: boolean;
  checkedAt: string;
  siteId?: string | null;
  instanceId?: string | null;
  expectedBlogAppId?: string;
  installedApps?: string[];
};

export type MemberPage = {
  members: MemberRow[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
  accessStorageAvailable: boolean;
};
