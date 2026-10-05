import { authentication, currentMember } from "@wix/site-members";
import styles from "./member-login-test.module.css";

class MemberLoginTest extends HTMLElement {
  connectedCallback() {
    this.render();
    void this.refreshMember();
  }

  disconnectedCallback() {
    // No long-lived listeners or timers to clean up in this test widget.
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

    try {
      const member = await currentMember.getMember();

      if (member) {
        status.textContent = "Signed in. Member session is active.";
        button.textContent = "Sign out";
      } else {
        status.textContent = "Not signed in.";
        button.textContent = "Sign in";
      }
    } catch {
      // Auth APIs can be unavailable while editing/previewing. The live site is the real test.
      status.textContent = "Not signed in.";
      button.textContent = "Sign in";
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
