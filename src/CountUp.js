import { useEffect } from "react";
import { animate, m, useMotionValue, useTransform } from "motion/react";

// Counts a number up (or down) to its new value
function CountUp({ to, delay = 0, duration = 1 }) {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(value, to, { duration, delay, ease: "easeOut" });
    return () => controls.stop();
  }, [to, delay, duration, value]);

  return <m.span>{rounded}</m.span>;
}

export default CountUp;