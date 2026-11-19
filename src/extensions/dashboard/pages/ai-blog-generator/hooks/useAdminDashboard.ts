import { useEffect, useState, type FormEvent } from "react";
import { fetchCredits, fetchMembers, fetchWixBlogStatus, updateMemberAccess } from "../lib/admin-api";
import type { Credits, MemberPage, MemberRow, WixBlogStatus } from "../types";

export const MEMBER_PAGE_SIZE = 20;

export function useAdminDashboard() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState("");
  const [wixBlogStatus, setWixBlogStatus] = useState<WixBlogStatus | null>(null);
  const [wixBlogStatusLoading, setWixBlogStatusLoading] = useState(true);
  const [wixBlogStatusError, setWixBlogStatusError] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [accessStorageAvailable, setAccessStorageAvailable] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const loadCredits = async () => {
    setCreditsLoading(true);
    setCreditsError("");
    try {
      setCredits(await fetchCredits());
    } catch (error) {
      setCreditsError(error instanceof Error ? error.message : "Unable to load Wix AI credits.");
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  };

  const loadWixBlogStatus = async () => {
    setWixBlogStatusLoading(true);
    setWixBlogStatusError("");
    try {
      setWixBlogStatus(await fetchWixBlogStatus());
    } catch (error) {
      setWixBlogStatusError(
        error instanceof Error ? error.message : "Unable to verify Wix Blog installation.",
      );
      setWixBlogStatus(null);
    } finally {
      setWixBlogStatusLoading(false);
    }
  };

  const loadMembers = async (nextOffset: number, searchTerm: string) => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const result: MemberPage = await fetchMembers(nextOffset, searchTerm);
      setMembers(result.members);
      setOffset(result.offset);
      setTotalMembers(result.total);
      setHasMore(result.hasMore);
      setAccessStorageAvailable(result.accessStorageAvailable);
      setActiveSearch(searchTerm);
    } catch (error) {
      setMembersError(
        error instanceof Error ? error.message : "Unable to load the Wix member directory.",
      );
      setMembers([]);
      setHasMore(false);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    void loadCredits();
    void loadMembers(0, "");
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
    setMembersError("");
    try {
      await updateMemberAccess(member.memberId, !member.approved);
      await loadMembers(offset, activeSearch);
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : "Unable to change member access.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const recheckSetup = () => {
    void loadCredits();
    void loadMembers(0, activeSearch);
    void loadWixBlogStatus();
  };

  return {
    credits,
    creditsLoading,
    creditsError,
    wixBlogStatus,
    wixBlogStatusLoading,
    wixBlogStatusError,
    members,
    membersLoading,
    membersError,
    memberSearch,
    setMemberSearch,
    activeSearch,
    offset,
    totalMembers,
    hasMore,
    accessStorageAvailable,
    updatingMemberId,
    loadCredits,
    loadMembers,
    submitSearch,
    changeAccess,
    recheckSetup,
  };
}
