import { Page, WixDesignSystemProvider } from "@wix/design-system";
import "@wix/design-system/styles.global.css";
import styles from "./ai-blog-generator.module.css";
import CreditsPanel from "./components/CreditsPanel";
import MemberAccessPanel from "./components/MemberAccessPanel";
import SetupStatusPanel from "./components/SetupStatusPanel";
import SummaryCards from "./components/SummaryCards";
import { useAdminDashboard } from "./hooks/useAdminDashboard";

export default function DashboardPage() {
  const dashboard = useAdminDashboard();

  const setupPending =
    dashboard.creditsLoading ||
    dashboard.membersLoading ||
    dashboard.wixBlogStatusLoading;
  const setupReady =
    !setupPending &&
    !dashboard.creditsError &&
    !dashboard.membersError &&
    !dashboard.wixBlogStatusError &&
    dashboard.wixBlogStatus?.installed === true &&
    dashboard.accessStorageAvailable;
  const setupStatusLabel = setupPending
    ? "Checking permissions"
    : setupReady ? "Connected" : "Action needed";
  const blogStatusLabel = dashboard.wixBlogStatusLoading
    ? "Checking installation"
    : dashboard.wixBlogStatusError
      ? "Unable to verify"
      : dashboard.wixBlogStatus?.installed
        ? "Installed"
        : "Not detected";
  const blogStatusCopy = dashboard.wixBlogStatusLoading
    ? "Checking the current site’s installed Wix apps…"
    : dashboard.wixBlogStatusError
      ? "Wix could not confirm the installation. Check the app-instance diagnostic or server logs."
      : dashboard.wixBlogStatus?.installed
        ? "Connected — Wix Blog is installed on this site. Drafts can be checked before saving."
        : "Wix’s app-instance list did not include the Wix Blog ID. Check the diagnostic details below before reinstalling Blog.";
  const blogStatusDot =
    !dashboard.wixBlogStatusLoading &&
    !dashboard.wixBlogStatusError &&
    dashboard.wixBlogStatus?.installed
      ? styles.statusReady
      : styles.statusPending;
  const blogInventoryDiagnostic = dashboard.wixBlogStatus && !dashboard.wixBlogStatus.installed
    ? [
        dashboard.wixBlogStatus.siteId ? "Site ID: " + dashboard.wixBlogStatus.siteId : null,
        dashboard.wixBlogStatus.instanceId
          ? "App instance: " + dashboard.wixBlogStatus.instanceId
          : null,
        "Expected Wix Blog ID: " +
          (dashboard.wixBlogStatus.expectedBlogAppId ?? "not returned"),
        "IDs reported by Wix: " + (dashboard.wixBlogStatus.installedApps?.length
          ? dashboard.wixBlogStatus.installedApps.join(", ")
          : "(empty list)"),
      ].filter(Boolean).join(" · ")
    : "";

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

            <SetupStatusPanel
              setupPending={setupPending}
              setupReady={setupReady}
              setupStatusLabel={setupStatusLabel}
              membersLoading={dashboard.membersLoading}
              membersError={dashboard.membersError}
              creditsLoading={dashboard.creditsLoading}
              creditsError={dashboard.creditsError}
              accessStorageAvailable={dashboard.accessStorageAvailable}
              blogStatusCopy={blogStatusCopy}
              blogStatusDot={blogStatusDot}
              blogInventoryDiagnostic={blogInventoryDiagnostic}
              onRecheck={dashboard.recheckSetup}
            />

            <SummaryCards
              accessStorageAvailable={dashboard.accessStorageAvailable}
              wixBlogStatus={dashboard.wixBlogStatus}
              wixBlogStatusLoading={dashboard.wixBlogStatusLoading}
              wixBlogStatusError={dashboard.wixBlogStatusError}
              blogStatusLabel={blogStatusLabel}
              blogStatusDot={blogStatusDot}
              blogInventoryDiagnostic={blogInventoryDiagnostic}
            />

            <CreditsPanel
              credits={dashboard.credits}
              loading={dashboard.creditsLoading}
              error={dashboard.creditsError}
              onRefresh={() => void dashboard.loadCredits()}
            />

            <MemberAccessPanel
              members={dashboard.members}
              loading={dashboard.membersLoading}
              error={dashboard.membersError}
              memberSearch={dashboard.memberSearch}
              onSearchChange={dashboard.setMemberSearch}
              activeSearch={dashboard.activeSearch}
              offset={dashboard.offset}
              totalMembers={dashboard.totalMembers}
              hasMore={dashboard.hasMore}
              accessStorageAvailable={dashboard.accessStorageAvailable}
              updatingMemberId={dashboard.updatingMemberId}
              onSearch={dashboard.submitSearch}
              onClearSearch={() => {
                dashboard.setMemberSearch("");
                void dashboard.loadMembers(0, "");
              }}
              onRefresh={() => void dashboard.loadMembers(dashboard.offset, dashboard.activeSearch)}
              onPageChange={(nextOffset) => {
                void dashboard.loadMembers(nextOffset, dashboard.activeSearch);
              }}
              onChangeAccess={(member) => {
                void dashboard.changeAccess(member);
              }}
            />

            <p className={styles.footerNote}>
              Approval is stored per Wix site installation. Site-member routes validate the signed-in member on the server.
              Blog articles are saved as unpublished drafts only after an explicit member action.
            </p>
          </main>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
}
