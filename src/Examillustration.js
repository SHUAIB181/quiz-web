import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

// A line-drawn scene that loops on the "Before you begin" screen.
// A pencil reads the question, shades in an answer bubble, the clock runs,
// and a tick is drawn. The line of text underneath changes with each step.

const CAPTIONS = [
  "Read the question carefully.",
  "Choose one answer.",
  "Keep an eye on the clock.",
  "Check, then submit.",
];

const BUBBLES = [105, 150, 195, 240];
const LETTERS = ["A", "B", "C", "D"];

// Where the tip of the pencil goes in each step
const PENCIL = [
  { x: [92, 250, 92, 200], y: [58, 58, 80, 80] },
  { x: 150, y: [112, 130] },
  { x: 262, y: 196 },
  { x: [222, 236, 268], y: [170, 184, 150] },
];

const PENCIL_TIMING = [
  { duration: 2.2, times: [0, 0.38, 0.46, 0.85], ease: "easeInOut" },
  { duration: 0.8, ease: "easeInOut" },
  { duration: 0.9, ease: "easeInOut" },
  { duration: 1.1, ease: "easeInOut" },
];

function ExamIllustration() {
  const calm = useReducedMotion();
  const [step, setStep] = useState(calm ? 3 : 0);

  useEffect(() => {
    if (calm) {
      setStep(3);
      return;
    }
    const timer = setInterval(() => setStep((n) => (n + 1) % 4), 2800);
    return () => clearInterval(timer);
  }, [calm]);

  const filled = step >= 1;

  return (
    <div className="scene-wrap">
      <svg className="scene" viewBox="0 0 420 240" aria-hidden="true">
        {/* the answer sheet */}
        <rect className="scene-sheet" x="70" y="24" width="210" height="190" rx="4" />

        {/* the question being read */}
        <m.path
          className="scene-line"
          d="M90 58 H250"
          initial={false}
          animate={step === 0 ? { pathLength: [0, 1] } : { pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
        <m.path
          className="scene-line"
          d="M90 80 H200"
          initial={false}
          animate={step === 0 ? { pathLength: [0, 1] } : { pathLength: 1 }}
          transition={{ duration: 0.6, delay: step === 0 ? 0.9 : 0 }}
        />

        {/* the answer bubbles */}
        {BUBBLES.map((cx, i) => (
          <g key={cx}>
            <circle className="scene-bubble" cx={cx} cy="130" r="14" />
            {i === 1 && (
              <m.circle
                className="scene-fill"
                cx={cx}
                cy="130"
                r="7"
                strokeWidth="14"
                transform={`rotate(-90 ${cx} 130)`}
                initial={false}
                animate={{ pathLength: filled ? 1 : 0 }}
                transition={{
                  duration: filled ? 0.35 : 0.2,
                  delay: filled && step === 1 ? 0.55 : 0,
                }}
              />
            )}
            <text
              className={`scene-letter ${i === 1 && filled ? "on" : ""}`}
              x={cx}
              y="130"
            >
              {LETTERS[i]}
            </text>
          </g>
        ))}

        {/* the tick at the end */}
        <m.path
          className="scene-tick"
          d="M222 170 L236 184 L268 150"
          initial={false}
          animate={{ pathLength: step === 3 ? 1 : 0 }}
          transition={{ duration: 0.5, delay: step === 3 ? 0.35 : 0 }}
        />

        {/* the clock */}
        <circle
          className={`scene-clock-ring ${step === 2 ? "pulse" : ""}`}
          cx="350"
          cy="72"
          r="34"
        />
        <path className="scene-clock-tick" d="M350 42 V48 M350 96 V102 M320 72 H326 M374 72 H380" />
        <line className="hand hand-hour" x1="350" y1="72" x2="350" y2="56" />
        <line className="hand hand-min" x1="350" y1="72" x2="350" y2="46" />
        <circle className="scene-clock-dot" cx="350" cy="72" r="3" />

        {/* the pencil */}
        <m.g
          initial={false}
          animate={PENCIL[step]}
          transition={PENCIL_TIMING[step]}
        >
          <g transform="rotate(32)">
            <path className="pencil-wood" d="M0 0 L-6 -16 H6 Z" />
            <path className="pencil-lead" d="M0 0 L-2.2 -6 H2.2 Z" />
            <rect className="pencil-body" x="-6" y="-70" width="12" height="54" />
            <path className="pencil-ridge" d="M0 -70 V-16" />
            <rect className="pencil-eraser" x="-6" y="-82" width="12" height="12" rx="2" />
          </g>
        </m.g>
      </svg>

      <div className="scene-caption">
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22 }}
          >
            {CAPTIONS[step]}
          </m.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ExamIllustration;