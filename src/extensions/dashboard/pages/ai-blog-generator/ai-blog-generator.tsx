import type { FC } from 'react';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import styles from './ai-blog-generator.module.css';

const DashboardPage: FC = () => {
  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title="AI Blog Generator"
          subtitle="Manage site access and your publishing workflow."
        />
        <Page.Content>
          <main className={styles.dashboard} aria-label="AI Blog Generator dashboard">
            <section className={styles.intro}>
              <p className={styles.eyebrow}>WORKSPACE OVERVIEW</p>
              <h2 className={styles.headline}>A controlled workflow for every blog.</h2>
              <p className={styles.introCopy}>
                Configure who can use the generator, then build a review process that keeps
                your team in control before anything is published.
              </p>
            </section>

            <section className={styles.summaryGrid} aria-label="Setup status">
              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={`${styles.statusDot} ${styles.statusReady}`} aria-hidden="true" />
                  <span className={styles.statusLabel}>Prototype available</span>
                </div>
                <h3 className={styles.cardTitle}>Member sign-in</h3>
                <p className={styles.cardCopy}>
                  The site widget uses Wix’s native member login and can detect an active
                  member session.
                </p>
              </article>

              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={`${styles.statusDot} ${styles.statusPending}`} aria-hidden="true" />
                  <span className={styles.statusLabel}>Setup required</span>
                </div>
                <h3 className={styles.cardTitle}>Workflow access</h3>
                <p className={styles.cardCopy}>
                  An approved-member list and server-side authorization checks have not
                  been connected yet.
                </p>
              </article>

              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={`${styles.statusDot} ${styles.statusPending}`} aria-hidden="true" />
                  <span className={styles.statusLabel}>Not connected</span>
                </div>
                <h3 className={styles.cardTitle}>Wix Blog API</h3>
                <p className={styles.cardCopy}>
                  Creating, updating, scheduling, and publishing drafts will be added after
                  access control is verified.
                </p>
              </article>
            </section>

            <section className={styles.panel} aria-labelledby="access-heading">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>ADMINISTRATION</p>
                  <h3 id="access-heading" className={styles.panelTitle}>Member access management</h3>
                  <p className={styles.panelCopy}>
                    Decide which site members are allowed to enter the blog-generation workflow.
                  </p>
                </div>
                <span className={styles.nextBadge}>Next milestone</span>
              </div>

              <div className={styles.notice} role="status">
                <strong className={styles.noticeTitle}>Access controls are not connected yet</strong>
                <p className={styles.noticeCopy}>
                  This dashboard currently reports implementation status only. It does not
                  grant or revoke access, and the sign-in widget alone does not authorize
                  someone to generate blogs.
                </p>
              </div>

              <div className={styles.nextSteps}>
                <h4 className={styles.stepsTitle}>What will be added here</h4>
                <ol className={styles.stepsList}>
                  <li>Search or identify a site member.</li>
                  <li>Grant or revoke that member’s access to this app’s workflow.</li>
                  <li>Save the access list per Wix site installation.</li>
                  <li>Enforce the same authorization check on every protected backend action.</li>
                </ol>
              </div>
            </section>

            <p className={styles.footerNote}>
              Prototype status is informational. No blog generation or member permissions are changed by this page.
            </p>
          </main>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default DashboardPage;
