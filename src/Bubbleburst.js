import { m } from "motion/react";

// Four answer bubbles that fill in and empty again, one after another.
// Used wherever a student waits: the server waking up, submitting at "time is up".
function BubbleLoader() {
  return (
    <svg
      className="bubble-loader"
      viewBox="0 0 132 32"
      role="img"
      aria-label="Loading"
    >
      {[0, 1, 2, 3].map((i) => {
        const cx = 16 + i * 34;
        return (
          <g key={i}>
            <circle className="scene-bubble" cx={cx} cy="16" r="12" />
            <m.circle
              className="scene-fill"
              cx={cx}
              cy="16"
              r="6"
              strokeWidth="12"
              transform={`rotate(-90 ${cx} 16)`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 1, 0] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                times: [0, 0.2, 0.8, 1],
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default BubbleLoader;