import type { FormEvent } from "react";
import styles from "../ai-blog-generator.module.css";
import { MEMBER_PAGE_SIZE } from "../hooks/useAdminDashboard";
import type { MemberRow } from "../types";

type Props = {
  members: MemberRow[];
  loading: boolean;
  error: string;
  memberSearch: string;
  onSearchChange: (value: string) => void;
  activeSearch: string;
  offset: number;
  totalMembers: number | null;
  hasMore: boolean;
  accessStorageAvailable: boolean;
  updatingMemberId: string | null;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClearSearch: () => void;
  onRefresh: () => void;
  onPageChange: (nextOffset: number) => void;
  onChangeAccess: (member: MemberRow) => void;
};

export default function MemberAccessPanel({
  members,
  loading,
  error,
  memberSearch,
  onSearchChange,
  activeSearch,
  offset,
  totalMembers,
  hasMore,
  accessStorageAvailable,
  updatingMemberId,
  onSearch,
  onClearSearch,
  onRefresh,
  onPageChange,
  onChangeAccess,
}: Props) {
  const pageNumber = Math.floor(offset / MEMBER_PAGE_SIZE) + 1;
  const pageDescription = totalMembers === null
    ? "Page " + pageNumber
    : "Page " + pageNumber + " of " + Math.max(1, Math.ceil(totalMembers / MEMBER_PAGE_SIZE));

  return (
    <section className={styles.panel} aria-labelledby="access-heading">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>ADMINISTRATION</p>
          <h3 id="access-heading" className={styles.panelTitle}>Site member access</h3>
          <p className={styles.panelCopy}>
            Live member data comes from Wix. Only approved members should be allowed into protected blog-generation actions.
          </p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh members"}
        </button>
      </div>

      <form className={styles.searchForm} onSubmit={onSearch}>
        <label className={styles.searchLabel} htmlFor="member-search">Find a site member</label>
        <div className={styles.searchControls}>
          <input
            id="member-search"
            className={styles.searchInput}
            value={memberSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            maxLength={100}
            placeholder="Search name or email"
          />
          <button className={styles.primaryButton} type="submit" disabled={loading}>
            Search
          </button>
          {activeSearch ? (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={loading}
              onClick={onClearSearch}
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {!accessStorageAvailable && !loading ? (
        <div className={styles.notice} role="status">
          <strong className={styles.noticeTitle}>Member directory loaded; approval storage needs setup</strong>
          <p className={styles.noticeCopy}>
            The list can still be inspected, but access actions remain disabled until the app’s site-specific collection is available.
            A new app release and site update may be required for Wix to provision it.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className={styles.errorNotice} role="alert">
          <strong>Member access request failed</strong>
          <p>{error}</p>
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
                  <span className={styles.memberEmail}>{member.email || "Email not provided by Wix"}</span>
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
                    disabled={!accessStorageAvailable || member.approved === null || loading || updatingMemberId !== null}
                    onClick={() => onChangeAccess(member)}
                  >
                    {updatingMemberId === member.memberId
                      ? "Saving…"
                      : member.approved
                        ? "Revoke"
                        : "Grant access"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && members.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={4}>
                  {activeSearch ? "No site members matched that search." : "No members were returned by Wix."}
                </td>
              </tr>
            ) : null}
            {loading && members.length === 0 ? (
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
            ? members.length + " members on this page"
            : totalMembers.toLocaleString() + " matching members"}
          {" · "}{pageDescription}
        </span>
        <div className={styles.paginationControls}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={loading || offset === 0}
            onClick={() => onPageChange(Math.max(0, offset - MEMBER_PAGE_SIZE))}
          >
            Previous
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={loading || !hasMore}
            onClick={() => onPageChange(offset + MEMBER_PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
