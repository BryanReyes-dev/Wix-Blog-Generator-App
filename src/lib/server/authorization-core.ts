export type WixSubjectType = 'APP' | 'USER' | 'MEMBER' | 'VISITOR' | 'UNKNOWN';

export type WixTokenInfo = {
  active: boolean;
  subjectType: WixSubjectType;
  subjectId: string;
  siteId?: string;
  instanceId?: string;
};

export type AuthenticatedIdentity = {
  userId: string;
  siteId: string;
  instanceId: string | null;
};

export type AuthenticatedMember = {
  memberId: string;
  siteId: string;
  instanceId: string | null;
};

export class ApiError extends Error {
  public readonly status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function getActiveWixToken(
  getTokenInfo: () => Promise<WixTokenInfo>,
): Promise<WixTokenInfo & { siteId: string }> {
  let token: WixTokenInfo;

  try {
    token = await getTokenInfo();
  } catch {
    throw new ApiError(401, 'Sign in through Wix before continuing.');
  }

  if (!token.active || !token.siteId || !token.subjectId) {
    throw new ApiError(401, 'A valid Wix session is required.');
  }

  return { ...token, siteId: token.siteId };
}

export function requireWixSubject(
  token: WixTokenInfo & { siteId: string },
  subjectType: 'USER',
): AuthenticatedIdentity;
export function requireWixSubject(
  token: WixTokenInfo & { siteId: string },
  subjectType: 'MEMBER',
): AuthenticatedMember;
export function requireWixSubject(
  token: WixTokenInfo & { siteId: string },
  subjectType: 'USER' | 'MEMBER',
): AuthenticatedIdentity | AuthenticatedMember {
  if (token.subjectType !== subjectType) {
    if (subjectType === 'USER') {
      throw new ApiError(403, 'A Wix dashboard user session is required.');
    }

    throw new ApiError(403, 'Sign in as a site member to use the blog workflow.');
  }

  if (subjectType === 'USER') {
    return {
      userId: token.subjectId,
      siteId: token.siteId,
      instanceId: token.instanceId ?? null,
    };
  }

  return {
    memberId: token.subjectId,
    siteId: token.siteId,
    instanceId: token.instanceId ?? null,
  };
}

export async function requireApprovedMember(
  token: WixTokenInfo & { siteId: string },
  checkApproval: (memberId: string) => Promise<boolean>,
): Promise<AuthenticatedMember> {
  const member = requireWixSubject(token, 'MEMBER');
  let approved: boolean;

  try {
    approved = await checkApproval(member.memberId);
  } catch {
    throw new ApiError(503, 'Workflow approval could not be verified. Access remains blocked.');
  }

  if (!approved) {
    throw new ApiError(403, 'This site member has not been approved for the blog workflow.');
  }

  return member;
}

export async function requirePrivilegedDashboardUser(
  token: WixTokenInfo & { siteId: string },
  checkPrivilege: () => Promise<boolean>,
): Promise<AuthenticatedIdentity> {
  const user = requireWixSubject(token, 'USER');

  try {
    if (await checkPrivilege()) return user;
  } catch (error) {
    // Preserve safe diagnostic errors while still denying access.
    if (error instanceof ApiError) {
      throw error;
    }
  }

  throw new ApiError(403, 'A Wix dashboard user with privileged site access is required.');
}
