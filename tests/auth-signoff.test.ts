import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@wix/essentials";
import { items } from "@wix/data";
import { members } from "@wix/members";
import {
  ApiError,
  isMemberApproved,
  requireApprovedSiteMember,
  requireDashboardUser,
  requireSiteMember,
} from "../src/lib/server/access-control";
import { GET as getAdminMembers } from "../src/pages/api/admin/members";
import { POST as postAdminWorkflowAccess } from "../src/pages/api/admin/workflow-access";
import { GET as getWorkflowAccess } from "../src/pages/api/workflow-access";

vi.mock("@wix/essentials", () => ({
  auth: {
    getTokenInfo: vi.fn(),
    elevate: vi.fn((operation: unknown) => operation),
  },
}));

vi.mock("@wix/data", () => ({
  items: {
    query: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@wix/members", () => ({
  members: {
    listMembers: vi.fn(),
    queryMembers: vi.fn(),
  },
}));

type SubjectType = "APP" | "USER" | "MEMBER" | "VISITOR" | "UNKNOWN";

function makeToken(
  subjectType: SubjectType,
  subjectId = "subject-test-id",
  active = true,
) {
  return {
    active,
    subjectType,
    subjectId,
    exp: 2_000_000_000,
    iat: 1_700_000_000,
    siteId: "site-test-id",
    instanceId: "instance-test-id",
  };
}

function setToken(token: ReturnType<typeof makeToken>) {
  vi.mocked(auth.getTokenInfo).mockResolvedValue(token);
}

function adminMembersContext() {
  return {
    url: new URL("https://app.example.test/api/admin/members"),
  } as never;
}

describe("server-side authentication and authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getTokenInfo).mockReset();
    vi.mocked(auth.elevate).mockReset();
    vi.mocked(auth.elevate).mockImplementation((operation) => operation as never);
    vi.mocked(items.query).mockReset();
    vi.mocked(items.save).mockReset();
    vi.mocked(items.remove).mockReset();
    vi.mocked(members.listMembers).mockReset();
    vi.mocked(members.queryMembers).mockReset();
  });

  describe("identity guards", () => {
    it("rejects a missing or invalid Wix session with 401", async () => {
      vi.mocked(auth.getTokenInfo).mockRejectedValue(new Error("No active Wix token"));

      await expect(requireDashboardUser()).rejects.toMatchObject({
        status: 401,
      });
      await expect(requireSiteMember()).rejects.toMatchObject({
        status: 401,
      });
    });

    it("rejects an inactive session with 401", async () => {
      setToken(makeToken("USER", "dashboard-user", false));

      await expect(requireDashboardUser()).rejects.toMatchObject({
        status: 401,
      });
    });

    it("rejects a site member from dashboard-only operations with 403", async () => {
      setToken(makeToken("MEMBER", "site-member"));

      await expect(requireDashboardUser()).rejects.toMatchObject({
        status: 403,
      });
    });

    it("rejects a dashboard user from site-member operations with 403", async () => {
      setToken(makeToken("USER", "dashboard-user"));

      await expect(requireSiteMember()).rejects.toMatchObject({
        status: 403,
      });
    });

    it("accepts an active dashboard-user identity for dashboard operations", async () => {
      setToken(makeToken("USER", "dashboard-user"));

      await expect(requireDashboardUser()).resolves.toMatchObject({
        userId: "dashboard-user",
        siteId: "site-test-id",
        instanceId: "instance-test-id",
      });
    });

    it("derives the site-member ID from the Wix token", async () => {
      setToken(makeToken("MEMBER", "member-from-token"));

      await expect(requireSiteMember()).resolves.toMatchObject({
        memberId: "member-from-token",
        siteId: "site-test-id",
      });
    });
  });

  describe("workflow approval", () => {
    it("returns approved only when the server-side allowlist contains the member", async () => {
      vi.mocked(items.query).mockResolvedValue({ items: [{ _id: "member-1" }] } as never);

      await expect(isMemberApproved("member-1")).resolves.toBe(true);
      expect(items.query).toHaveBeenCalledWith(
        "@bg478806/blog-generator/WorkflowAccess",
        expect.objectContaining({
          filter: { memberId: { $eq: "member-1" } },
          paging: { limit: 1, offset: 0 },
        }),
        { consistentRead: true },
      );
    });

    it("treats a missing approval record as unapproved", async () => {
      vi.mocked(items.query).mockResolvedValue({ items: [] } as never);

      await expect(isMemberApproved("member-1")).resolves.toBe(false);
    });

    it("rejects an unapproved member with 403", async () => {
      setToken(makeToken("MEMBER", "unapproved-member"));
      vi.mocked(items.query).mockResolvedValue({ items: [] } as never);

      await expect(requireApprovedSiteMember()).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("not been approved"),
      });
    });

    it("fails closed when approval storage is unavailable", async () => {
      setToken(makeToken("MEMBER", "member-1"));
      vi.mocked(items.query).mockRejectedValue(new Error("Wix Data unavailable"));

      await expect(requireApprovedSiteMember()).rejects.toThrow("Wix Data unavailable");
    });
  });

  describe("actual API route responses", () => {
    it("returns a non-empty JSON 401 from the admin member endpoint without a session", async () => {
      vi.mocked(auth.getTokenInfo).mockRejectedValue(new Error("No active Wix token"));

      const response = await getAdminMembers(adminMembersContext());

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({
        error: expect.any(String),
      });
      expect(members.listMembers).not.toHaveBeenCalled();
    });

    it("returns JSON 403 when a site-member session calls the admin member endpoint", async () => {
      setToken(makeToken("MEMBER", "site-member"));

      const response = await getAdminMembers(adminMembersContext());

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: expect.any(String),
      });
      expect(members.listMembers).not.toHaveBeenCalled();
    });

    it("returns 401 from the member approval endpoint without a session", async () => {
      vi.mocked(auth.getTokenInfo).mockRejectedValue(new Error("No active Wix token"));

      const response = await getWorkflowAccess({} as never);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: expect.any(String),
      });
    });

    it("fails closed with a JSON error when member approval cannot be verified", async () => {
      setToken(makeToken("MEMBER", "member-1"));
      vi.mocked(items.query).mockRejectedValue(new Error("Wix Data unavailable"));

      const response = await getWorkflowAccess({} as never);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toEqual(expect.any(String));
      expect(body.authorized).not.toBe(true);
    });

    it("allows an authenticated dashboard user to grant workflow access", async () => {
      setToken(makeToken("USER", "dashboard-user"));
      vi.mocked(items.save).mockResolvedValue({} as never);

      const memberId = "550e8400-e29b-41d4-a716-446655440000";
      const response = await postAdminWorkflowAccess({
        request: {
          json: vi.fn().mockResolvedValue({ memberId, enabled: true }),
        },
      } as never);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ memberId, approved: true });
      expect(items.save).toHaveBeenCalledWith(
        "@bg478806/blog-generator/WorkflowAccess",
        expect.objectContaining({
          _id: memberId,
          memberId,
          grantedBy: "dashboard-user",
        }),
      );
    });

    it("does not let a site member call the grant-access endpoint", async () => {
      setToken(makeToken("MEMBER", "site-member"));

      const response = await postAdminWorkflowAccess({
        request: {
          json: vi.fn().mockResolvedValue({
            memberId: "550e8400-e29b-41d4-a716-446655440000",
            enabled: true,
          }),
        },
      } as never);

      expect(response.status).toBe(403);
      expect(items.save).not.toHaveBeenCalled();
      expect(items.remove).not.toHaveBeenCalled();
    });
  });
});
