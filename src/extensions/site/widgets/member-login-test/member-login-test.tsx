import { httpClient } from "@wix/essentials";
import { location } from "@wix/site-location";
import { authentication, currentMember } from "@wix/site-members";
import styles from "./member-login-test.module.css";
import { mountBlogWorkflow } from './blog-workflow';

const ROUTES = {
  login: "/admin",
  workflow: "/admin/workflow",
  permissionDenied: "/admin/permission-denied",
} as const;

type AccessCheck =
  | { state: "signed-out"; memberExists: false }
  | { state: "approved" | "denied"; memberExists: true }
  | { state: "unavailable"; memberExists: boolean };

class MemberLoginTest extends HTMLElement {
  connectedCallback() {
    void this.initialize();
  }

  private async initialize() {
    let route: string;

    try {
      // Wix returns the current site's path as segments, excluding the domain.
      const segments = await location.path();
      route = `/${segments.map((segment) => segment.trim()).filter(Boolean).join("/")}`;
    } catch {
      this.renderMessage(
        "Authentication routing unavailable",
        "Open the published development site to check member authentication and page navigation.",
        true,
      );
      return;
    }

    if (route === ROUTES.login) {
      this.renderLoginPage();
      await this.refreshLoginPage();
      return;
    }

    if (route === ROUTES.workflow || route === ROUTES.permissionDenied) {
      await this.guardRoute(route);
      return;
    }

    this.renderMessage(
      "Widget placed on the wrong page",
      "Place this widget on /admin, /admin/workflow, or /admin/permission-denied.",
    );
  }

  private createPanel(titleText: string, messageText: string) {
    this.innerHTML = "";

    const root = document.createElement("div");
    root.className = styles.root;

    const title = document.createElement("h2");
    title.className = styles.title;
    title.textContent = titleText;

    const status = document.createElement("p");
    status.className = styles.status;
    status.dataset.status = "true";
    status.textContent = messageText;

    root.append(title, status);
    this.appendChild(root);
    return { root, status };
  }

  private renderLoginPage() {
    const { root } = this.createPanel(
      "Intern sign-in",
      "Checking your Wix member session and workflow approval…",
    );

    const authButton = document.createElement("button");
    authButton.className = styles.button;
    authButton.type = "button";
    authButton.dataset.authButton = "true";
    authButton.dataset.authAction = "sign-in";
    authButton.textContent = "Sign in with Wix";
    authButton.addEventListener("click", () => {
      const status = this.querySelector<HTMLParagraphElement>("[data-status]");
      if (status) void this.handleAuth(authButton, status);
    });

    const retryButton = document.createElement("button");
    retryButton.className = styles.button;
    retryButton.type = "button";
    retryButton.dataset.retryButton = "true";
    retryButton.textContent = "Retry access check";
    retryButton.hidden = true;
    retryButton.addEventListener("click", () => {
      void this.refreshLoginPage();
    });

    root.append(authButton, retryButton);
  }

  private async refreshLoginPage() {
    const status = this.querySelector<HTMLParagraphElement>("[data-status]");
    const authButton = this.querySelector<HTMLButtonElement>("[data-auth-button]");
    const retryButton = this.querySelector<HTMLButtonElement>("[data-retry-button]");

    if (!status || !authButton || !retryButton) return;

    status.textContent = "Checking your Wix member session and workflow approval…";
    retryButton.hidden = true;

    const check = await this.checkAccess();

    switch (check.state) {
      case "signed-out":
        status.textContent = "You are not signed in.";
        authButton.textContent = "Sign in with Wix";
        authButton.dataset.authAction = "sign-in";
        return;

      case "approved":
        status.textContent = "Access approved. Opening the workflow…";
        location.to(ROUTES.workflow);
        return;

      case "denied":
        status.textContent = "Your account is signed in but is not approved. Redirecting…";
        location.to(ROUTES.permissionDenied);
        return;

      case "unavailable":
        status.textContent = check.memberExists
          ? "You are signed in, but approval could not be verified. Access remains blocked; retry or sign out."
          : "Your member session or approval could not be verified. Retry the check or sign in again.";
        authButton.textContent = check.memberExists ? "Sign out" : "Sign in with Wix";
        authButton.dataset.authAction = check.memberExists ? "sign-out" : "sign-in";
        retryButton.hidden = false;
        return;
    }
  }

  private async checkAccess(): Promise<AccessCheck> {
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
      if (!response.ok) return { state: "unavailable", memberExists: true };

      const result = (await response.json()) as { authorized?: unknown };
      if (typeof result.authorized !== "boolean") {
        return { state: "unavailable", memberExists: true };
      }

      return result.authorized
        ? { state: "approved", memberExists: true }
        : { state: "denied", memberExists: true };
    } catch {
      return { state: "unavailable", memberExists: true };
    }
  }

  private async handleAuth(button: HTMLButtonElement, status: HTMLParagraphElement) {
    const action = button.dataset.authAction ?? "sign-in";
    button.disabled = true;
    status.textContent = action === "sign-out" ? "Signing out…" : "Opening Wix member login…";

    try {
      if (action === "sign-out") {
        await authentication.logout();
      } else {
        await authentication.promptLogin({ mode: "login", modal: true });
      }

      await this.refreshLoginPage();
    } catch {
      status.textContent = action === "sign-out"
        ? "Sign-out could not be completed. Please try again."
        : "Sign-in was canceled or could not be completed.";
    } finally {
      button.disabled = false;
    }
  }

  private async guardRoute(route: string) {
    this.renderMessage("Checking workflow access…", "Verifying your signed-in member and approval status.");
    const check = await this.checkAccess();

    if (check.state === "unavailable") {
      this.renderMessage(
        "Unable to verify access",
        "This page stays unavailable until Wix member status and workflow approval can be verified.",
        true,
      );
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

      this.renderWorkflowPage();
      return;
    }

    if (check.state === "approved") {
      location.to(ROUTES.workflow);
      return;
    }

    this.renderMessage(
      "Permission denied",
      "You are signed in, but the site team has not approved your account for the blog-generation workflow. Contact the site administrator if you believe this is a mistake.",
      false,
      true,
    );
  }

  private renderWorkflowPage() {
    mountBlogWorkflow(this, async () => {
      await authentication.logout();
      location.to(ROUTES.login);
    });
  }

  private renderMessage(title: string, message: string, showRetry = false, showSignOut = false) {
    const { root } = this.createPanel(title, message);

    if (showRetry) {
      const retryButton = document.createElement("button");
      retryButton.className = styles.button;
      retryButton.type = "button";
      retryButton.textContent = "Retry access check";
      retryButton.addEventListener("click", () => {
        void this.initialize();
      });
      root.appendChild(retryButton);
    }

    if (showSignOut) {
      const signOutButton = document.createElement("button");
      signOutButton.className = styles.button;
      signOutButton.type = "button";
      signOutButton.textContent = "Sign out";
      signOutButton.addEventListener("click", async () => {
        signOutButton.disabled = true;
        const status = root.querySelector<HTMLParagraphElement>("[data-status]");
        if (status) status.textContent = "Signing out…";

        try {
          await authentication.logout();
          location.to(ROUTES.login);
        } catch {
          if (status) status.textContent = "Sign-out could not be completed. Please try again.";
          signOutButton.disabled = false;
        }
      });
      root.appendChild(signOutButton);
    }
  }
}

export default MemberLoginTest;
