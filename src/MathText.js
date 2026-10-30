import katex from "katex";
import "katex/dist/katex.min.css";

// Plain text stays plain. Anything written between two $ signs is drawn as a formula:
//   What is $\sqrt{16}$ ?       ->  What is √16 ?
// To show a real dollar sign, write \$ (for example: it costs \$5).
const splitMath = (text) => {
  const parts = [];
  let plain = "";
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "\\" && text[i + 1] === "$") {
      plain += "$";
      i += 2;
      continue;
    }

    if (char === "$") {
      let j = i + 1;
      while (j < text.length && !(text[j] === "$" && text[j - 1] !== "\\")) {
        j += 1;
      }

      if (j < text.length && j > i + 1) {
        if (plain) parts.push({ type: "text", value: plain });
        plain = "";
        parts.push({ type: "math", value: text.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }

    plain += char;
    i += 1;
  }

  if (plain) parts.push({ type: "text", value: plain });
  return parts;
};

function MathText({ text }) {
  if (typeof text !== "string") return null;

  return (
    <>
      {splitMath(text).map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>;
        }

        // KaTeX returns safe markup. Only the formula goes through this path;
        // all other text is escaped by React as usual.
        const html = katex.renderToString(part.value, {
          throwOnError: false,
          strict: "ignore",
          trust: false,
        });

        return (
          <span
            key={index}
            className="math"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}

export default MathText;