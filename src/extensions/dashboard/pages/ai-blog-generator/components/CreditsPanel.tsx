import styles from "../ai-blog-generator.module.css";
import type { Credits } from "../types";

type Props = {
  credits: Credits | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

export default function CreditsPanel({ credits, loading, error, onRefresh }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="credits-heading">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>WIX ACCOUNT</p>
          <h3 id="credits-heading" className={styles.panelTitle}>Available AI credits</h3>
          <p className={styles.panelCopy}>
            Retrieved from Wix’s AI Credits API. The returned wallet scope is shown so account-wide credits are not mislabeled as site-only credits.
          </p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh credits"}
        </button>
      </div>

      {loading && !credits ? (
        <p className={styles.helperText} role="status">Fetching the latest Wix credit balance…</p>
      ) : null}

      {error ? (
        <div className={styles.errorNotice} role="alert">
          <strong>Credit balance unavailable</strong>
          <p>{error}</p>
          <p>Confirm the AI Credits API permission in Wix Developer Center. The app will not substitute a fabricated zero balance.</p>
        </div>
      ) : null}

      {credits ? (
        <>
          <div className={styles.creditsSummary}>
            <div>
              <span className={styles.metricLabel}>Available total</span>
              <strong className={styles.creditTotal}>{credits.totalAvailable.toLocaleString()}</strong>
              <span className={styles.metricFootnote}>
                {credits.walletScope === "SITE"
                  ? "Site wallet"
                  : credits.walletScope === "ACCOUNT"
                    ? "Wix account wallet"
                    : "Wallet scope: " + credits.walletScope}
              </span>
            </div>
            <div className={styles.creditBreakdown}>
              <div>
                <span className={styles.metricLabel}>Recurring</span>
                <strong>{credits.periodicCredits.balance.toLocaleString()}</strong>
                <span className={styles.metricFootnote}>
                  {credits.periodicCredits.cap === null
                    ? "Cap not provided"
                    : "of " + credits.periodicCredits.cap.toLocaleString()}
                </span>
              </div>
              <div>
                <span className={styles.metricLabel}>Top-up</span>
                <strong>{credits.topUpCredits.balance.toLocaleString()}</strong>
                <span className={styles.metricFootnote}>
                  {credits.topUpCredits.cap === null
                    ? "Cap not provided"
                    : "of " + credits.topUpCredits.cap.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <p className={styles.footerNote}>
            Last fetched {new Date(credits.checkedAt).toLocaleString()}.
          </p>
        </>
      ) : null}
    </section>
  );
}
