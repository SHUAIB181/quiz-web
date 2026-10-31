import { useState } from "react";
import { m } from "motion/react";
import { isSoundOn, setSoundOn, tick } from "./feedback";

// The speaker button in the top bar
function SoundToggle() {
  const [on, setOn] = useState(isSoundOn());

  const toggle = () => {
    const next = !on;
    setSoundOn(next);
    setOn(next);
    if (next) tick(true);
  };

  return (
    <m.button
      type="button"
      className="sound-toggle"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Sound on" : "Sound off"}
      title={on ? "Sound on" : "Sound off"}
      whileTap={{ scale: 0.9 }}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M3 8h3l4-3.5v11L6 12H3z" />
        {on ? (
          <>
            <path d="M13 7.5a3.5 3.5 0 010 5" />
            <path d="M15.2 5.5a6.5 6.5 0 010 9" />
          </>
        ) : (
          <path d="M13 8l4 4M17 8l-4 4" />
        )}
      </svg>
    </m.button>
  );
}

export default SoundToggle;