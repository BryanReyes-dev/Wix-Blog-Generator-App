import { useEffect, useState, type FC, type FormEvent } from 'react';
import { httpClient } from '@wix/essentials';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import styles from './ai-blog-generator.module.css';

const APP_ID = '012509d2-64ed-4670-bc27-8299e942673f';
const APP_INSTALLER_URL = `https://wix.com/app-installer?appId=${APP_ID}`;
const API_BASE_URL = new URL(import.meta.url).origin;
const PAGE_SIZE = 20;

type MemberRow = {
  memberId: string;
  name: string;
  email: string | null;
  status: string;
  activityStatus: string;
  privacyStatus: string;
  approved: boolean | null;
};

type Credits = {
  periodicCredits: { balance: number; cap: number | null };
  topUpCredits: { balance: number; cap: number | null };
  totalAvailable: number;
  walletScope: string;
  checkedAt: string;
};

type WixBlogStatus = {
  installed: boolean;
  checkedAt: string;
  siteId?: string | null;
  instanceId?: string | null;
  expectedBlogAppId?: string;
  installedApps?: string[];
};

type MemberPage = {
  members: MemberRow[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
  accessStorageAvailable: boolean;
};

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // The response may not contain JSON.
  }

  return 'The request failed. Check app permissions and site setup.';
}

const DashboardPage: FC = () => {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState('');
  const [wixBlogStatus, setWixBlogStatus] = useState<WixBlogStatus | null>(null);
  const [wixBlogStatusLoading, setWixBlogStatusLoading] = useState(true);
  const [wixBlogStatusError, setWixBlogStatusError] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [accessStorageAvailable, setAccessStorageAvailable] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const loadCredits = async () => {
    setCreditsLoading(true);
    setCreditsError('');

    try {
      const response = await httpClient.fetchWithAuth(API_BASE_URL + '/api/admin/credits');
      if (!response.ok) throw new Error(await readApiError(response));
      setCredits(await response.json() as Credits);
    } catch (error) {
      setCreditsError(error instanceof Error ? error.message : 'Unable to load Wix AI credits.');
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  };

  const loadWixBlogStatus = async () => {
    setWixBlogStatusLoading(true);
    setWixBlogStatusError('');

    try {
      const response = await httpClient.fetchWithAuth(API_BASE_URL + '/api/admin/blog-status');
      if (!response.ok) throw new Error(await readApiError(response));
      setWixBlogStatus(await response.json() as WixBlogStatus);
    } catch (error) {
      setWixBlogStatusError(error instanceof Error ? error.message : 'Unable to verify Wix Blog installation.');
      setWixBlogStatus(null);
    } finally {
      setWixBlogStatusLoading(false);
    }
  };

  const loadMembers = async (nextOffset: number, searchTerm: string) => {
    setMembersLoading(true);
    setMembersError('');

    try {
      const url = new URL(API_BASE_URL + '/api/admin/members');
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(nextOffset));
      if (searchTerm) url.searchParams.set('search', searchTerm);

      const response = await httpClient.fetchWithAuth(url.toString());
      if (!response.ok) throw new Error(await readApiError(response));

      const result = await response.json() as MemberPage;
      setMembers(result.members);
      setOffset(result.offset);
      setTotalMembers(result.total);
      setHasMore(result.hasMore);
      setAccessStorageAvailable(result.accessStorageAvailable);
      setActiveSearch(searchTerm);
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : 'Unable to load the Wix member directory.');
      setMembers([]);
      setHasMore(false);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    void loadCredits();
    void loadMembers(0, '');
    void loadWixBlogStatus();
    // Load live Wix data when the dashboard opens.
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadMembers(0, memberSearch.trim().slice(0, 100));
  };

  const changeAccess = async (member: MemberRow) => {
    if (member.approved === null || !accessStorageAvailable || updatingMemberId) return;

    setUpdatingMemberId(member.memberId);
    setMembersError('');

    try {
      const response = await httpClient.fetchWithAuth(API_BASE_URL + '/api/admin/workflow-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.memberId,
          enabled: !member.approved,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));
      await loadMembers(offset, activeSearch);
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : 'Unable to change member access.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageDescription = totalMembers === null
    ? 'Page ' + pageNumber
    : 'Page ' + pageNumber + ' of ' + Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));
  const setupPending = creditsLoading || membersLoading || wixBlogStatusLoading;
  const setupReady = !setupPending &&
    !creditsError &&
    !membersError &&
    !wixBlogStatusError &&
    wixBlogStatus?.installed === true &&
    accessStorageAvailable;
  const setupStatusLabel = setupPending
    ? 'Checking permissions'
    : setupReady ? 'Connected' : 'Action needed';
  const blogStatusLabel = wixBlogStatusLoading
    ? 'Checking installation'
    : wixBlogStatusError
      ? 'Unable to verify'
      : wixBlogStatus?.installed
        ? 'Installed'
        : 'Not detected';
  const blogStatusCopy = wixBlogStatusLoading
    ? 'Checking the current site’s installed Wix apps…'
    : wixBlogStatusError
      ? 'Wix could not confirm the installation. Check the app-instance diagnostic or server logs.'
      : wixBlogStatus?.installed
        ? 'Connected — Wix Blog is installed on this site. Drafts can be checked before saving.'
        : 'Wix’s app-instance list did not include the Wix Blog ID. Check the diagnostic details below before reinstalling Blog.';
  const blogStatusDot = !wixBlogStatusLoading && !wixBlogStatusError && wixBlogStatus?.installed
    ? styles.statusReady
    : styles.statusPending;
  const blogInventoryDiagnostic = wixBlogStatus && !wixBlogStatus.installed
    ? [
        wixBlogStatus.siteId ? 'Site ID: ' + wixBlogStatus.siteId : null,
        wixBlogStatus.instanceId ? 'App instance: ' + wixBlogStatus.instanceId : null,
        'Expected Wix Blog ID: ' + (wixBlogStatus.expectedBlogAppId ?? 'not returned'),
        'IDs reported by Wix: ' + (wixBlogStatus.installedApps?.length
          ? wixBlogStatus.installedApps.join(', ')
          : '(empty list)'),
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title="AI Blog Generator"
          subtitle="Manage site access, review Wix AI credits, and check member draft workflow setup."
        />
        <Page.Content>
          <main className={styles.dashboard} aria-label="AI Blog Generator dashboard">
            <section className={styles.intro}>
              <p className={styles.eyebrow}>WORKSPACE OVERVIEW</p>
              <h2 className={styles.headline}>A controlled workflow for every blog.</h2>
              <p className={styles.introCopy}>
                Use the live Wix member directory to approve access. Credit balance is fetched from Wix
                when this dashboard opens. Approved members use the protected site workflow to generate,
                review, and explicitly save unpublished Wix Blog drafts.
              </p>
            </section>

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
                    onClick={() => {
                      void loadCredits();
                      void loadMembers(0, activeSearch);
                      void loadWixBlogStatus();
                    }}
                    disabled={setupPending}
                  >
                    {setupPending ? 'Checking…' : 'Recheck access'}
                  </button>
                </div>
              </div>

              <p className={styles.setupOverall} role="status" aria-live="polite">
                <span className={styles.statusDot + ' ' + (setupPending ? styles.statusPending : setupReady ? styles.statusReady : styles.statusPending)} aria-hidden="true" />
                <strong>{setupStatusLabel}</strong>
                {setupReady
                  ? ' — member lookup, credit balance, workflow approval storage, and Wix Blog installation are available.'
                  : setupPending
                    ? ' — checking access with Wix.'
                    : ' — review the checks below and resolve any blocked permissions or storage setup.'}
              </p>

              <div className={styles.setupGrid}>
                <article className={styles.setupItem}>
                  <span className={styles.statusDot + ' ' + (membersLoading ? styles.statusPending : membersError ? styles.statusPending : styles.statusReady)} aria-hidden="true" />
                  <div>
                    <strong>Site member directory</strong>
                    <p>{membersLoading ? 'Checking Read Members access…' : membersError ? 'Wix member access failed. Check the error in the member directory below.' : 'Connected — member lookup is working.'}</p>
                  </div>
                </article>

                <article className={styles.setupItem}>
                  <span className={styles.statusDot + ' ' + (creditsLoading ? styles.statusPending : creditsError ? styles.statusPending : styles.statusReady)} aria-hidden="true" />
                  <div>
                    <strong>AI credit balance</strong>
                    <p>{creditsLoading ? 'Checking Wix AI Credits access…' : creditsError ? 'Wix AI Credits access is not available. Review the credit error below.' : 'Connected — the live credit balance is available.'}</p>
                  </div>
                </article>

                <article className={styles.setupItem}>
                  <span className={styles.statusDot + ' ' + (setupPending && !accessStorageAvailable ? styles.statusPending : accessStorageAvailable ? styles.statusReady : styles.statusPending)} aria-hidden="true" />
                  <div>
                    <strong>Workflow approval storage</strong>
                    <p>{membersLoading ? 'Checking the app-owned data collection…' : accessStorageAvailable ? 'Connected — approval records can be read.' : 'Unavailable — confirm the app-owned collection has been provisioned on this site.'}</p>
                  </div>
                </article>

                <article className={styles.setupItem}>
                  <span className={styles.statusDot + ' ' + blogStatusDot} aria-hidden="true" />
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

            <section className={styles.summaryGrid} aria-label="Setup status">
              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={styles.statusDot + ' ' + styles.statusReady} aria-hidden="true" />
                  <span className={styles.statusLabel}>Prototype available</span>
                </div>
                <h3 className={styles.cardTitle}>Member sign-in</h3>
                <p className={styles.cardCopy}>
                  Wix handles sign-in. The site widget now checks the signed-in member’s workflow approval on the backend.
                </p>
              </article>

              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={styles.statusDot + ' ' + (accessStorageAvailable ? styles.statusReady : styles.statusPending)} aria-hidden="true" />
                  <span className={styles.statusLabel}>{accessStorageAvailable ? 'Storage connected' : 'Provisioning required'}</span>
                </div>
                <h3 className={styles.cardTitle}>Workflow access</h3>
                <p className={styles.cardCopy}>
                  {accessStorageAvailable
                    ? 'Member approvals are loaded from this site’s app-owned access collection.'
                    : 'The app-owned access collection must be provisioned and its permissions granted before access can be changed.'}
                </p>
              </article>

              <article className={styles.statusCard}>
                <div className={styles.cardTopline}>
                  <span className={styles.statusDot + ' ' + blogStatusDot} aria-hidden="true" />
                  <span className={styles.statusLabel}>{blogStatusLabel}</span>
                </div>
                <h3 className={styles.cardTitle}>Wix Blog drafts</h3>
                <p className={styles.cardCopy}>
                  {wixBlogStatusLoading
                    ? 'Checking whether Wix Blog is installed on this site…'
                    : wixBlogStatusError
                      ? 'Installation could not be verified. ' + wixBlogStatusError
                      : wixBlogStatus?.installed
                        ? 'Wix Blog is installed. Members review and edit generated content before explicitly saving an unpublished draft; publishing is not available.'
                        : 'Wix’s app-instance list did not include the Wix Blog ID. No draft will be attempted until the inventory mismatch is resolved.'}
                </p>
                {!wixBlogStatusError && !wixBlogStatusLoading && wixBlogStatus?.installed === false ? (
                  <p className={styles.memberEmail}>{blogInventoryDiagnostic}</p>
                ) : null}
              </article>
            </section>

            <section className={styles.panel} aria-labelledby="credits-heading">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>WIX ACCOUNT</p>
                  <h3 id="credits-heading" className={styles.panelTitle}>Available AI credits</h3>
                  <p className={styles.panelCopy}>
                    Retrieved from Wix’s AI Credits API. The returned wallet scope is shown so account-wide credits are not mislabeled as site-only credits.
                  </p>
                </div>
                <button className={styles.secondaryButton} type="button" onClick={() => void loadCredits()} disabled={creditsLoading}>
                  {creditsLoading ? 'Refreshing…' : 'Refresh credits'}
                </button>
              </div>

              {creditsLoading && !credits ? (
                <p className={styles.helperText} role="status">Fetching the latest Wix credit balance…</p>
              ) : null}

              {creditsError ? (
                <div className={styles.errorNotice} role="alert">
                  <strong>Credit balance unavailable</strong>
                  <p>{creditsError}</p>
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
                        {credits.walletScope === 'SITE' ? 'Site wallet' : credits.walletScope === 'ACCOUNT' ? 'Wix account wallet' : 'Wallet scope: ' + credits.walletScope}
                      </span>
                    </div>
                    <div className={styles.creditBreakdown}>
                      <div>
                        <span className={styles.metricLabel}>Recurring</span>
                        <strong>{credits.periodicCredits.balance.toLocaleString()}</strong>
                        <span className={styles.metricFootnote}>
                          {credits.periodicCredits.cap === null ? 'Cap not provided' : 'of ' + credits.periodicCredits.cap.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className={styles.metricLabel}>Top-up</span>
                        <strong>{credits.topUpCredits.balance.toLocaleString()}</strong>
                        <span className={styles.metricFootnote}>
                          {credits.topUpCredits.cap === null ? 'Cap not provided' : 'of ' + credits.topUpCredits.cap.toLocaleString()}
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

            <section className={styles.panel} aria-labelledby="access-heading">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>ADMINISTRATION</p>
                  <h3 id="access-heading" className={styles.panelTitle}>Site member access</h3>
                  <p className={styles.panelCopy}>
                    Live member data comes from Wix. Only approved members should be allowed into protected blog-generation actions.
                  </p>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => void loadMembers(offset, activeSearch)}
                  disabled={membersLoading}
                >
                  {membersLoading ? 'Loading…' : 'Refresh members'}
                </button>
              </div>

              <form className={styles.searchForm} onSubmit={submitSearch}>
                <label className={styles.searchLabel} htmlFor="member-search">Find a site member</label>
                <div className={styles.searchControls}>
                  <input
                    id="member-search"
                    className={styles.searchInput}
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    maxLength={100}
                    placeholder="Search name or email"
                  />
                  <button className={styles.primaryButton} type="submit" disabled={membersLoading}>
                    Search
                  </button>
                  {activeSearch ? (
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={membersLoading}
                      onClick={() => {
                        setMemberSearch('');
                        void loadMembers(0, '');
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </form>

              {!accessStorageAvailable && !membersLoading ? (
                <div className={styles.notice} role="status">
                  <strong className={styles.noticeTitle}>Member directory loaded; approval storage needs setup</strong>
                  <p className={styles.noticeCopy}>
                    The list can still be inspected, but access actions remain disabled until the app’s site-specific collection is available.
                    A new app release and site update may be required for Wix to provision it.
                  </p>
                </div>
              ) : null}

              {membersError ? (
                <div className={styles.errorNotice} role="alert">
                  <strong>Member access request failed</strong>
                  <p>{membersError}</p>
                </div>
              ) : null}

              <div className={styles.memberTableWrap}>
                <table className={styles.memberTable}>
                  <thead>
                    <tr>
                      <th scope="col">Site member</th>
                      <th scope="col">Wix status</th>
                      <th scope="col">Workflow access</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.memberId}>
                        <td>
                          <strong className={styles.memberName}>{member.name}</strong>
                          <span className={styles.memberEmail}>{member.email || 'Email not provided by Wix'}</span>
                        </td>
                        <td>
                          <span className={styles.wixStatus}>{member.status}</span>
                          <span className={styles.memberEmail}>{member.activityStatus} · {member.privacyStatus}</span>
                        </td>
                        <td>
                          {member.approved === null ? (
                            <span className={styles.unknownState}>Unknown</span>
                          ) : member.approved ? (
                            <span className={styles.approvedState}>Approved</span>
                          ) : (
                            <span className={styles.deniedState}>Not approved</span>
                          )}
                        </td>
                        <td>
                          <button
                            className={member.approved ? styles.revokeButton : styles.primaryButton}
                            type="button"
                            disabled={!accessStorageAvailable || member.approved === null || membersLoading || updatingMemberId !== null}
                            onClick={() => void changeAccess(member)}
                          >
                            {updatingMemberId === member.memberId
                              ? 'Saving…'
                              : member.approved
                                ? 'Revoke'
                                : 'Grant access'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!membersLoading && members.length === 0 ? (
                      <tr>
                        <td className={styles.emptyCell} colSpan={4}>
                          {activeSearch ? 'No site members matched that search.' : 'No members were returned by Wix.'}
                        </td>
                      </tr>
                    ) : null}
                    {membersLoading && members.length === 0 ? (
                      <tr>
                        <td className={styles.emptyCell} colSpan={4}>Loading site members from Wix…</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <span className={styles.helperText}>
                  {totalMembers === null
                    ? members.length + ' members on this page'
                    : totalMembers.toLocaleString() + ' matching members'}
                  {' · '}{pageDescription}
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={membersLoading || offset === 0}
                    onClick={() => void loadMembers(Math.max(0, offset - PAGE_SIZE), activeSearch)}
                  >
                    Previous
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={membersLoading || !hasMore}
                    onClick={() => void loadMembers(offset + PAGE_SIZE, activeSearch)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>

            <p className={styles.footerNote}>
              Approval is stored per Wix site installation. Site-member routes validate the signed-in member on the server.
              Blog articles are saved as unpublished drafts only after an explicit member action.
            </p>
          </main>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default DashboardPage;
