import { authentication, currentMember } from "@wix/site-members";
import { httpClient } from "@wix/essentials";
import styles from "./member-login-test.module.css";

class MemberLoginTest extends HTMLElement {
  connectedCallback() {
    this.render();
    void this.refreshMember();
  }

  disconnectedCallback() {
    // No long-lived listeners or timers to clean up in this widget.
  }

  private render() {
    this.innerHTML = "";

    const root = document.createElement("div");
    root.className = styles.root;

    const title = document.createElement("h2");
    title.className = styles.title;
    title.textContent = "Blog Generator";

    const status = document.createElement("p");
    status.className = styles.status;
    status.textContent = "Checking member session…";

    const button = document.createElement("button");
    button.className = styles.button;
    button.type = "button";
    button.textContent = "Sign in";
    button.addEventListener("click", () => {
      void this.handleAuth(button, status);
    });

    root.append(title, status, button);
    this.appendChild(root);
  }

  private async refreshMember() {
    const status = this.querySelector("p");
    const button = this.querySelector("button");

    if (!(status instanceof HTMLParagraphElement) || !(button instanceof HTMLButtonElement)) {
      return;
    }

    let member: Awaited<ReturnType<typeof currentMember.getMember>> | null = null;

    try {
      member = await currentMember.getMember();
    } catch {
      status.textContent = "Member sign-in is unavailable in this preview. Try the published development site.";
      button.textContent = "Sign in";
      return;
    }

    if (!member) {
      status.textContent = "Not signed in.";
      button.textContent = "Sign in";
      return;
    }

    button.textContent = "Sign out";
    status.textContent = "Signed in. Checking workflow access…";

    try {
      const baseApiUrl = new URL(import.meta.url).origin;
      const response = await httpClient.fetchWithAuth(baseApiUrl + "/api/workflow-access");

      if (!response.ok) {
        status.textContent = "Signed in, but workflow access could not be verified. Try again later.";
        return;
      }

      const result = await response.json() as { authorized?: boolean };
      status.textContent = result.authorized
        ? "Signed in. Workflow access approved."
        : "Signed in, but access has not been granted. Contact the site team.";
    } catch {
      status.textContent = "Signed in, but workflow access could not be verified. Try again later.";
    }
  }

  private async handleAuth(button: HTMLButtonElement, status: HTMLParagraphElement) {
    button.disabled = true;
    status.textContent = "Opening Wix member login…";

    try {
      if (button.textContent === "Sign out") {
        await authentication.logout();
      } else {
        await authentication.promptLogin({ mode: "login", modal: true });
      }

      await this.refreshMember();
    } catch {
      status.textContent = "Login was canceled or could not be completed.";
    } finally {
      button.disabled = false;
    }
  }
}

export default MemberLoginTest;
