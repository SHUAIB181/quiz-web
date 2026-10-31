import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

// One button for the whole site. It gives every button the same feel:
//  - lifts a little on hover and squishes when pressed, with a spring back
//  - an ink-drop ripple from exactly where you clicked
//  - status="loading" shows bouncing dots, status="done" shows a tick
//  - wake: when this turns true (the button becomes useful), a sheen sweeps across it
//  - when its text changes (Next question -> Submit Quiz) the label rolls over
const Button = forwardRef(function Button(
  {
    children,
    className = "",
    status = "idle",
    wake = false,
    disabled,
    onPointerDown,
    ...rest
  },
  ref
) {
  const calm = useReducedMotion();
  const [ripples, setRipples] = useState([]);
  const [sweeps, setSweeps] = useState(0);
  const wasWake = useRef(wake);

  useEffect(() => {
    if (wake && !wasWake.current && !calm) setSweeps((n) => n + 1);
    wasWake.current = wake;
  }, [wake, calm]);

  const handlePointerDown = (event) => {
    if (onPointerDown) onPointerDown(event);
    if (disabled || calm) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const radius = Math.hypot(
      Math.max(x, rect.width - x),
      Math.max(y, rect.height - y)
    );

    setRipples((list) => [
      ...list,
      { id: Date.now() + Math.random(), x, y, scale: (radius * 2) / 20 },
    ]);
  };

  const rollKey = typeof children === "string" ? children : "static";

  return (
    <m.button
      ref={ref}
      className={`${className} press`}
      data-status={status}
      disabled={disabled}
      aria-busy={status === "loading" || undefined}
      onPointerDown={handlePointerDown}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      {...rest}
    >
      <span className="btn-label" data-hidden={status !== "idle"}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={rollKey}
            className="btn-text"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {children}
          </m.span>
        </AnimatePresence>
      </span>

      <AnimatePresence>
        {status === "loading" && (
          <m.span
            key="loading"
            className="btn-status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          >
            {[0, 1, 2].map((dot) => (
              <m.span
                key={dot}
                className="btn-dot"
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: dot * 0.12,
                }}
              />
            ))}
          </m.span>
        )}

        {status === "done" && (
          <m.span
            key="done"
            className="btn-status"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" width="18" height="18">
              <path d="M3 8.5l3.2 3.2L13 4.8" />
            </svg>
          </m.span>
        )}
      </AnimatePresence>

      {ripples.map((ripple) => (
        <m.span
          key={ripple.id}
          className="ink-ripple"
          style={{ left: ripple.x, top: ripple.y }}
          initial={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: ripple.scale, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          onAnimationComplete={() =>
            setRipples((list) => list.filter((item) => item.id !== ripple.id))
          }
        />
      ))}

      {sweeps > 0 && (
        <m.span
          key={sweeps}
          className="btn-sweep"
          initial={{ x: "-110%" }}
          animate={{ x: "110%" }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}
    </m.button>
  );
});

export default Button;