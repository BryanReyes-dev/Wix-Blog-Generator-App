import styles from "../ai-blog-generator.module.css";

const APP_ID = "012509d2-64ed-4670-bc27-8299e942673f";
const APP_INSTALLER_URL = `https://wix.com/app-installer?appId=${APP_ID}`;

type Props = {
  setupPending: boolean;
  setupReady: boolean;
  setupStatusLabel: string;
  membersLoading: boolean;
  membersError: string;
  creditsLoading: boolean;
  creditsError: string;
  accessStorageAvailable: boolean;
  blogStatusCopy: string;
  blogStatusDot: string;
  blogInventoryDiagnostic: string;
  onRecheck: () => void;
};

export default function SetupStatusPanel({
  setupPending,
  setupReady,
  setupStatusLabel,
  membersLoading,
  membersError,
  creditsLoading,
  creditsError,
  accessStorageAvailable,
  blogStatusCopy,
  blogStatusDot,
  blogInventoryDiagnostic,
  onRecheck,
}: Props) {
  return (
    <section className={styles.setupPanel} aria-labelledby="setup-heading">
      <div className={styles.setupHeader}>
        <div>
          <p className={styles.eyebrow}>QUICK SETUP</p>
          <h3 id="setup-heading" className={styles.panelTitle}>Setup and permission status</h3>
          <p className={styles.panelCopy}>
            Check the access this dashboard needs. Rechecking does not grant permissions; Wix controls approval during installation or an app update.
          </p>
        </div>
        <div className={styles.setupActions}>
          <a
            className={`${styles.primaryButton} ${styles.buttonLink}`}
            href={APP_INSTALLER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Wix to review and approve an app update"
          >
            Review permissions in Wix
          </a>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onRecheck}
            disabled={setupPending}
          >
            {setupPending ? "Checking…" : "Recheck access"}
          </button>
        </div>
      </div>

      <p className={styles.setupOverall} role="status" aria-live="polite">
        <span
          className={styles.statusDot + " " + (setupPending
            ? styles.statusPending
            : setupReady ? styles.statusReady : styles.statusPending)}
          aria-hidden="true"
        />
        <strong>{setupStatusLabel}</strong>
        {setupReady
          ? " — member lookup, credit balance, workflow approval storage, and Wix Blog installation are available."
          : setupPending
            ? " — checking access with Wix."
            : " — review the checks below and resolve any blocked permissions or storage setup."}
      </p>

      <div className={styles.setupGrid}>
        <article className={styles.setupItem}>
          <span
            className={styles.statusDot + " " + (membersLoading || membersError
              ? styles.statusPending
              : styles.statusReady)}
            aria-hidden="true"
          />
          <div>
            <strong>Site member directory</strong>
            <p>
              {membersLoading
                ? "Checking Read Members access…"
                : membersError
                  ? "Wix member access failed. Check the error in the member directory below."
                  : "Connected — member lookup is working."}
            </p>
          </div>
        </article>

        <article className={styles.setupItem}>
          <span
            className={styles.statusDot + " " + (creditsLoading || creditsError
              ? styles.statusPending
              : styles.statusReady)}
            aria-hidden="true"
          />
          <div>
            <strong>AI credit balance</strong>
            <p>
              {creditsLoading
                ? "Checking Wix AI Credits access…"
                : creditsError
                  ? "Wix AI Credits access is not available. Review the credit error below."
                  : "Connected — the live credit balance is available."}
            </p>
          </div>
        </article>

        <article className={styles.setupItem}>
          <span
            className={styles.statusDot + " " + (setupPending && !accessStorageAvailable
              ? styles.statusPending
              : accessStorageAvailable ? styles.statusReady : styles.statusPending)}
            aria-hidden="true"
          />
          <div>
            <strong>Workflow approval storage</strong>
            <p>
              {membersLoading
                ? "Checking the app-owned data collection…"
                : accessStorageAvailable
                  ? "Connected — approval records can be read."
                  : "Unavailable — confirm the app-owned collection has been provisioned on this site."}
            </p>
          </div>
        </article>

        <article className={styles.setupItem}>
          <span className={styles.statusDot + " " + blogStatusDot} aria-hidden="true" />
          <div>
            <strong>Wix Blog installation</strong>
            <p>{blogStatusCopy}</p>
          </div>
        </article>
      </div>

      <p className={styles.setupNote}>
        Permission scopes are configured by the app developer, not granted by this screen. Use “Review permissions in Wix” to open Wix’s app-installer update flow. For an already-installed released app, adding scopes requires a major app version and the site owner must approve the update; this button cannot grant permissions by itself. On development sites, saved scopes should apply automatically after a short delay, so persistent 403 errors still need the installation’s granted permissions checked. The AI model itself does not inherit these app permissions; its capabilities will be limited to the specific server-side actions we expose to it.
      </p>
    </section>
  );
}
