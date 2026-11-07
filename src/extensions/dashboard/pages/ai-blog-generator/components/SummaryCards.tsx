import styles from "../ai-blog-generator.module.css";
import type { WixBlogStatus } from "../types";

type Props = {
  accessStorageAvailable: boolean;
  wixBlogStatus: WixBlogStatus | null;
  wixBlogStatusLoading: boolean;
  wixBlogStatusError: string;
  blogStatusLabel: string;
  blogStatusDot: string;
  blogInventoryDiagnostic: string;
};

export default function SummaryCards({
  accessStorageAvailable,
  wixBlogStatus,
  wixBlogStatusLoading,
  wixBlogStatusError,
  blogStatusLabel,
  blogStatusDot,
  blogInventoryDiagnostic,
}: Props) {
  return (
    <section className={styles.summaryGrid} aria-label="Setup status">
      <article className={styles.statusCard}>
        <div className={styles.cardTopline}>
          <span className={styles.statusDot + " " + styles.statusReady} aria-hidden="true" />
          <span className={styles.statusLabel}>Prototype available</span>
        </div>
        <h3 className={styles.cardTitle}>Member sign-in</h3>
        <p className={styles.cardCopy}>
          Wix handles sign-in. The site widget now checks the signed-in member’s workflow approval on the backend.
        </p>
      </article>

      <article className={styles.statusCard}>
        <div className={styles.cardTopline}>
          <span className={styles.statusDot + " " + (accessStorageAvailable
            ? styles.statusReady
            : styles.statusPending)} aria-hidden="true" />
          <span className={styles.statusLabel}>
            {accessStorageAvailable ? "Storage connected" : "Provisioning required"}
          </span>
        </div>
        <h3 className={styles.cardTitle}>Workflow access</h3>
        <p className={styles.cardCopy}>
          {accessStorageAvailable
            ? "Member approvals are loaded from this site’s app-owned access collection."
            : "The app-owned access collection must be provisioned and its permissions granted before access can be changed."}
        </p>
      </article>

      <article className={styles.statusCard}>
        <div className={styles.cardTopline}>
          <span className={styles.statusDot + " " + blogStatusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>{blogStatusLabel}</span>
        </div>
        <h3 className={styles.cardTitle}>Wix Blog drafts</h3>
        <p className={styles.cardCopy}>
          {wixBlogStatusLoading
            ? "Checking whether Wix Blog is installed on this site…"
            : wixBlogStatusError
              ? "Installation could not be verified. " + wixBlogStatusError
              : wixBlogStatus?.installed
                ? "Wix Blog is installed. Members review and edit generated content before explicitly saving an unpublished draft; publishing is not available."
                : "Wix’s app-instance list did not include the Wix Blog ID. No draft will be attempted until the inventory mismatch is resolved."}
        </p>
        {!wixBlogStatusError && !wixBlogStatusLoading && wixBlogStatus?.installed === false ? (
          <p className={styles.memberEmail}>{blogInventoryDiagnostic}</p>
        ) : null}
      </article>
    </section>
  );
}
