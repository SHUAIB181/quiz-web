import { useMemo } from "react";
import { m } from "motion/react";

const COLORS = ["var(--ink)", "var(--blue)", "var(--red)", "var(--green)"];

// A burst of answer-sheet bubbles from the middle of the score
function BubbleBurst({ count = 14, delay = 1.1 }) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 95 + Math.random() * 85;
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 20,
          size: 8 + Math.random() * 12,
          color: COLORS[i % COLORS.length],
        };
      }),
    [count]
  );

  return (
    <div className="burst" aria-hidden="true">
      {bubbles.map((bubble) => (
        <m.span
          key={bubble.id}
          className="burst-bubble"
          style={{
            width: bubble.size,
            height: bubble.size,
            marginLeft: -bubble.size / 2,
            marginTop: -bubble.size / 2,
            background: bubble.color,
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: bubble.x,
            y: bubble.y,
            scale: [0, 1.2, 1],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 1.1,
            delay: delay + bubble.id * 0.015,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export default BubbleBurst;