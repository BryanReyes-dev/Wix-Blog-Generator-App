import { useEffect, useState } from "react";
import { MAX_RESEARCH_LINKS } from "../lib/constants";
import { loadPreferences, savePreferences } from "../lib/preferences";
import { makeId } from "../lib/ids";
import type { Preferences, ResearchLink, Theme } from "../types";

export function useArticlePreferences(memberId: string) {
  const storageKey = memberId ? "wix-blog-generator:preferences:v1:" + memberId : null;
  const [savedPreferences] = useState<Partial<Preferences>>(() => loadPreferences(storageKey));
  const [theme, setTheme] = useState<Theme>(savedPreferences.theme === "light" ? "light" : "dark");
  const [topic, setTopic] = useState(typeof savedPreferences.topic === "string" ? savedPreferences.topic : "");
  const [audience, setAudience] = useState(typeof savedPreferences.audience === "string" ? savedPreferences.audience : "");
  const [tone, setTone] = useState(typeof savedPreferences.tone === "string" ? savedPreferences.tone : "");
  const [instructions, setInstructions] = useState(typeof savedPreferences.instructions === "string" ? savedPreferences.instructions : "");
  const [keywords, setKeywords] = useState(typeof savedPreferences.keywords === "string" ? savedPreferences.keywords : "");
  const [researchLinks, setResearchLinks] = useState<ResearchLink[]>(() => {
    const safeLinks = Array.isArray(savedPreferences.researchLinks)
      ? savedPreferences.researchLinks
          .slice(0, MAX_RESEARCH_LINKS)
          .filter((entry) => entry && typeof entry.url === "string")
      : [];

    return safeLinks.map((entry) => ({
      id: makeId(),
      url: entry.url,
      notes: typeof entry.notes === "string" ? entry.notes.slice(0, 500) : "",
    }));
  });

  useEffect(() => {
    savePreferences(storageKey, {
      theme,
      topic,
      audience,
      tone,
      instructions,
      keywords,
      researchLinks: researchLinks
        .map((link) => ({ url: link.url, notes: link.notes }))
        .filter((link) => link.url.trim()),
    });
  }, [storageKey, theme, topic, audience, tone, instructions, keywords, researchLinks]);

  const updateResearchLink = (id: string, field: "url" | "notes", value: string) => {
    setResearchLinks((current) => current.map((link) =>
      link.id === id ? { ...link, [field]: value } : link,
    ));
  };

  const addResearchLink = () => {
    if (researchLinks.length >= MAX_RESEARCH_LINKS) return;
    setResearchLinks((current) => [...current, { id: makeId(), url: "", notes: "" }]);
  };

  const removeResearchLink = (id: string) => {
    setResearchLinks((current) => current.filter((link) => link.id !== id));
  };

  const saveNow = (links: Preferences["researchLinks"] = researchLinks.map(
    (link) => ({ url: link.url, notes: link.notes }),
  )) => {
    savePreferences(storageKey, {
      theme,
      topic,
      audience,
      tone,
      instructions,
      keywords,
      researchLinks: links,
    });
  };

  return {
    theme,
    setTheme,
    topic,
    setTopic,
    audience,
    setAudience,
    tone,
    setTone,
    instructions,
    setInstructions,
    keywords,
    setKeywords,
    researchLinks,
    updateResearchLink,
    addResearchLink,
    removeResearchLink,
    saveNow,
  };
}
