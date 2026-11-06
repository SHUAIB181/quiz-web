import { useEffect, useRef, useState } from "react";

// The student's name, repeated faintly across the page. A screenshot of the quiz
// then shows whose it is.
export function watermarkImage(name) {
  const safe = String(name).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]));

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='170'>` +
    `<text x='140' y='85' text-anchor='middle' transform='rotate(-25 140 85)' ` +
    `font-family='Segoe UI, sans-serif' font-size='20' font-weight='600' ` +
    `fill='rgba(20,32,58,0.11)'>${safe}</text></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Watches for a student leaving the quiz window and for screenshot or print attempts.
// It can detect and discourage. It cannot block a screenshot, or a photo of the screen.
//
//   active             turn the watching on while the quiz is running
//   requireFullscreen  leaving full screen counts as leaving the window
//   onViolation(type)  called once per incident: "hidden", "blur", "fullscreen-exit",
//                      "printscreen" or "print"
//
// Returns { away }: true while the window is not in front, so the page can be hidden.
export function useProtection({ active, requireFullscreen, onViolation }) {
  const [away, setAway] = useState(false);
  const report = useRef(onViolation);
  const lastAt = useRef(0);

  report.current = onViolation;

  useEffect(() => {
    if (!active) {
      setAway(false);
      return undefined;
    }

    const startedAt = Date.now();
    document.body.classList.add("protected");

    const violation = (type) => {
      const now = Date.now();
      if (now - startedAt < 2000) return; // let the page settle after starting
      if (now - lastAt.current < 1500) return; // one incident often fires several events
      lastAt.current = now;
      report.current(type);
    };

    const clearClipboard = () => {
      try {
        const result = navigator.clipboard.writeText(" ");
        if (result && result.catch) result.catch(() => {});
      } catch (error) {
        // clearing the clipboard is a best effort
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setAway(true);
        violation("hidden");
      } else {
        setAway(false);
      }
    };

    const onBlur = () => {
      setAway(true);
      violation("blur");
    };

    const onFocus = () => {
      if (!document.hidden) setAway(false);
    };

    const onFullscreen = () => {
      if (requireFullscreen && !document.fullscreenElement) {
        violation("fullscreen-exit");
      }
    };

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && key === "p") {
        event.preventDefault();
        violation("print");
      } else if (modifier && ["s", "u", "c", "x", "a"].includes(key)) {
        event.preventDefault();
      } else if (key === "f12" || (modifier && event.shiftKey && ["i", "j", "c"].includes(key))) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event) => {
      if (event.key === "PrintScreen") {
        clearClipboard();
        violation("printscreen");
      }
    };

    const block = (event) => event.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);

    return () => {
      document.body.classList.remove("protected");
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
    };
  }, [active, requireFullscreen]);

  return { away };
}