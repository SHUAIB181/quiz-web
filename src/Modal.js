import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A popup that fades in over the page.
// - Escape or a click outside closes it, unless you leave out onClose
// - Tab stays inside it, and focus returns to where it was when it closes
// - Put data-autofocus on the button that should be focused first
function Modal({ open, onClose, title, tone = "default", children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    if (panel) {
      const target =
        panel.querySelector("[data-autofocus]") ||
        panel.querySelector(FOCUSABLE) ||
        panel;
      target.focus();
    }

    const onKey = (event) => {
      if (event.key === "Escape" && closeRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const items = panelRef.current.querySelectorAll(FOCUSABLE);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
      if (previous && previous.focus) previous.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && closeRef.current) {
              closeRef.current();
            }
          }}
        >
          <m.div
            ref={panelRef}
            className={`modal-panel ${tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Modal;