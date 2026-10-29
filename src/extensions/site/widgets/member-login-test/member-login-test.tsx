import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { httpClient } from "@wix/essentials";
import { location } from "@wix/site-location";
import { authentication, currentMember } from "@wix/site-members";
import "./../../../../styles/tailwind.css";
import BlogWorkflow from "./blog-workflow";

const ROUTES = {
  login: "/admin",
  workflow: "/admin/workflow",
  permissionDenied: "/admin/permission-denied",
} as const;

type AccessCheck =
  | { state: "signed-out"; memberExists: false }
  | { state: "approved" | "denied"; memberExists: true; memberId: string }
  | { state: "unavailable"; memberExists: boolean; reason?: string };

type MemberIdentity = { memberId: string; displayName: string };
type Screen =
  | { kind: "loading"; title: string; message: string }
  | { kind: "login"; status: string; action: "sign-in" | "sign-out"; retryVisible: boolean; statusKind?: "info" | "error" }
  | { kind: "workflow"; identity: MemberIdentity }
  | { kind: "message"; title: string; message: string; showRetry: boolean; showSignOut: boolean };

const PANEL_CLASS =
  "mx-auto flex min-h-[280px] w-full min-w-0 max-w-3xl flex-col items-start justify-center gap-4 rounded-2xl border border-[#2e394b] bg-[#0a0d13] p-4 text-[#f1f5fb] sm:p-8";
const BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border border-transparent bg-[#4a8dff] px-4 py-3 text-sm font-semibold leading-5 text-white transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8db7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d13] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border border-[#44536a] bg-[#1a2230] px-4 py-3 text-sm font-semibold leading-5 text-[#f1f5fb] transition-colors hover:bg-[#202a3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8db7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d13] disabled:cursor-not-allowed disabled:opacity-50";

async function checkAccess(): Promise<AccessCheck> {
  let member: Awaited<ReturnType<typeof currentMember.getMember>>;

  try {
    member = await currentMember.getMember();
  } catch {
    return { state: "unavailable", memberExists: false };
  }

  if (!member) return { state: "signed-out", memberExists: false };

  try {
    const apiUrl = new URL(import.meta.url).origin + "/api/workflow-access";
    const response = await httpClient.fetchWithAuth(apiUrl);
    if (!response.ok) {
      let reason = "Approval API returned HTTP " + response.status + ".";
      try {
        const payload = await response.json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) {
          reason = payload.error.trim().slice(0, 220);
        }
      } catch {
        // Use the HTTP status when the response is not JSON.
      }
      return { state: "unavailable", memberExists: true, reason };
    }

    const result = await response.json() as { authorized?: unknown; memberId?: unknown };
    if (typeof result.authorized !== "boolean" || typeof result.memberId !== "string" || !result.memberId) {
      return {
        state: "unavailable",
        memberExists: true,
        reason: "The approval API returned an unexpected response. Check the server logs.",
      };
    }

    return result.authorized
      ? { state: "approved", memberExists: true, memberId: result.memberId }
      : { state: "denied", memberExists: true, memberId: result.memberId };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 120) : "network error";
    return {
      state: "unavailable",
      memberExists: true,
      reason: "Could not reach the approval API (" + detail + "). Check the browser Console for network or CORS errors; during local development, also check the wix dev terminal.",
    };
  }
}

async function getMemberDisplayName(): Promise<string> {
  try {
    const member = await currentMember.getMember();
    const details = member as unknown as {
      profile?: { nickname?: string | null; firstName?: string | null; lastName?: string | null };
      contactDetails?: { firstName?: string | null; lastName?: string | null };
    };
    const profileName = details.profile?.nickname?.trim();
    const fullName = [
      details.contactDetails?.firstName ?? details.profile?.firstName,
      details.contactDetails?.lastName ?? details.profile?.lastName,
    ]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .join(" ")
      .trim();
    return profileName || fullName || "Wix member";
  } catch {
    // The verified member ID still identifies the session.
    return "Wix member";
  }
}

function AccessPanel({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <section className={PANEL_CLASS}>
      <h2 className="m-0 break-words text-2xl font-bold leading-tight tracking-tight text-[#f1f5fb] sm:text-3xl">{title}</h2>
      <p role="status" aria-live="polite" className="m-0 break-words text-sm leading-6 text-[#a5b1c2]">{message}</p>
      {children ? <div className="flex w-full flex-wrap gap-3">{children}</div> : null}
    </section>
  );
}

function MemberLoginApp() {
  const [screen, setScreen] = useState<Screen>({
    kind: "loading",
    title: "Checking workflow access…",
    message: "Verifying your signed-in member and approval status.",
  });
  const [authBusy, setAuthBusy] = useState(false);

  const refreshLoginPage = useCallback(async () => {
    setScreen({
      kind: "login",
      status: "Checking your Wix member session and workflow approval…",
      action: "sign-in",
      retryVisible: false,
    });

    const check = await checkAccess();
    switch (check.state) {
      case "signed-out":
        setScreen({ kind: "login", status: "You are not signed in.", action: "sign-in", retryVisible: false });
        return;
      case "approved":
        setScreen({
          kind: "loading",
          title: "Access approved",
          message: "Opening the workflow…",
        });
        location.to(ROUTES.workflow);
        return;
      case "denied":
        setScreen({
          kind: "loading",
          title: "Access not approved",
          message: "Redirecting to the permission page…",
        });
        location.to(ROUTES.permissionDenied);
        return;
      case "unavailable":
        setScreen({
          kind: "login",
          status: check.memberExists
            ? "You are signed in, but approval could not be verified." +
              (check.reason ? " Details: " + check.reason : "") +
              " Access remains blocked; retry or sign out."
            : "Your member session or approval could not be verified." +
              (check.reason ? " Details: " + check.reason : "") +
              " Retry the check or sign in again.",
          action: check.memberExists ? "sign-out" : "sign-in",
          retryVisible: true,
          statusKind: "error",
        });
        return;
    }
  }, []);

  const initialize = useCallback(async () => {
    let route: string;

    try {
      const segments = await location.path();
      route = "/" + segments.map((segment) => segment.trim()).filter(Boolean).join("/");
    } catch {
      setScreen({
        kind: "message",
        title: "Authentication routing unavailable",
        message: "Open the published development site to check member authentication and page navigation.",
        showRetry: true,
        showSignOut: false,
      });
      return;
    }

    if (route === ROUTES.login) {
      await refreshLoginPage();
      return;
    }

    if (route !== ROUTES.workflow && route !== ROUTES.permissionDenied) {
      setScreen({
        kind: "message",
        title: "Widget placed on the wrong page",
        message: "Place this widget on /admin, /admin/workflow, or /admin/permission-denied.",
        showRetry: false,
        showSignOut: false,
      });
      return;
    }

    setScreen({
      kind: "loading",
      title: "Checking workflow access…",
      message: "Verifying your signed-in member and approval status.",
    });
    const check = await checkAccess();

    if (check.state === "unavailable") {
      setScreen({
        kind: "message",
        title: "Unable to verify access",
        message: "This page stays unavailable until Wix member status and workflow approval can be verified.",
        showRetry: true,
        showSignOut: false,
      });
      return;
    }

    if (check.state === "signed-out") {
      location.to(ROUTES.login);
      return;
    }

    if (route === ROUTES.workflow) {
      if (check.state === "denied") {
        location.to(ROUTES.permissionDenied);
        return;
      }

      const displayName = await getMemberDisplayName();
      setScreen({
        kind: "workflow",
        identity: { memberId: check.memberId, displayName },
      });
      return;
    }

    if (check.state === "approved") {
      location.to(ROUTES.workflow);
      return;
    }

    setScreen({
      kind: "message",
      title: "Permission denied",
      message: "You are signed in, but the site team has not approved your account for the blog-generation workflow. Contact the site administrator if you believe this is a mistake.",
      showRetry: false,
      showSignOut: true,
    });
  }, [refreshLoginPage]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleAuth = async () => {
    if (screen.kind !== "login" || authBusy) return;
    const action = screen.action;
    setAuthBusy(true);
    setScreen((current) => current.kind === "login"
      ? { ...current, status: action === "sign-out" ? "Signing out…" : "Opening Wix member login…" }
      : current);

    try {
      if (action === "sign-out") {
        await authentication.logout();
      } else {
        await authentication.promptLogin({ mode: "login", modal: true });
      }
      await refreshLoginPage();
    } catch {
      setScreen({
        kind: "login",
        status: action === "sign-out"
          ? "Sign-out could not be completed. Please try again."
          : "Sign-in was canceled or could not be completed.",
        action,
        retryVisible: true,
        statusKind: "error",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMessageSignOut = async () => {
    if (screen.kind !== "message") return;
    setScreen({ ...screen, message: "Signing out…" });
    try {
      await authentication.logout();
      location.to(ROUTES.login);
    } catch {
      setScreen((current) => current.kind === "message"
        ? { ...current, message: "Sign-out could not be completed. Please try again." }
        : current);
    }
  };

  return (
    <div className="box-border w-full min-w-0 bg-[#0a0d13] p-3 font-sans text-[#f1f5fb] sm:p-4">
      {screen.kind === "loading" ? (
        <AccessPanel title={screen.title} message={screen.message} />
      ) : null}

      {screen.kind === "login" ? (
        <AccessPanel title="Intern sign-in" message={screen.status}>
          <button type="button" onClick={() => void handleAuth()} disabled={authBusy} className={BUTTON_CLASS}>
            {authBusy ? (screen.action === "sign-out" ? "Signing out…" : "Opening Wix login…") :
              screen.action === "sign-out" ? "Sign out" : "Sign in with Wix"}
          </button>
          {screen.retryVisible ? (
            <button type="button" onClick={() => void refreshLoginPage()} disabled={authBusy} className={SECONDARY_BUTTON_CLASS}>
              Retry access check
            </button>
          ) : null}
        </AccessPanel>
      ) : null}

      {screen.kind === "message" ? (
        <AccessPanel title={screen.title} message={screen.message}>
          {screen.showRetry ? (
            <button type="button" onClick={() => void initialize()} className={BUTTON_CLASS}>Retry access check</button>
          ) : null}
          {screen.showSignOut ? (
            <button type="button" onClick={() => void handleMessageSignOut()} className={BUTTON_CLASS}>Sign out</button>
          ) : null}
        </AccessPanel>
      ) : null}

      {screen.kind === "workflow" ? (
        <BlogWorkflow
          identity={screen.identity}
          signOut={async () => {
            await authentication.logout();
            location.to(ROUTES.login);
          }}
        />
      ) : null}
    </div>
  );
}

class MemberLoginTest extends HTMLElement {
  private reactRoot: Root | null = null;

  connectedCallback() {
    if (this.reactRoot) return;
    // The Wix widget host must behave like a block so its React layout can use the full width.
    this.style.display = "block";
    this.style.width = "100%";
    this.style.minWidth = "0";
    this.reactRoot = createRoot(this);
    this.reactRoot.render(<MemberLoginApp />);
  }

  disconnectedCallback() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
  }
}

export default MemberLoginTest;
