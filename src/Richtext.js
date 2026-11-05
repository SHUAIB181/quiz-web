import MathText from "./MathText";

// Shows a written solution:
//  - a blank line starts a new paragraph
//  - lines that start with "- " become a bullet list
//  - **text** is bold, and $...$ is a formula
//  - lines that start with "Step 1:", "Shortcut:", "Tip:", "Note:" or "Answer:" get a bold label
const LABEL = /^(Step \d+:|Shortcut:|Tip:|Note:|Common mistake:|Answer:|Check:)\s*/i;

const inline = (text) =>
  text.split("**").map((piece, i) =>
    i % 2 === 1 ? (
      <strong key={i}>
        <MathText text={piece} />
      </strong>
    ) : (
      <MathText key={i} text={piece} />
    )
  );

const line = (text) => {
  const match = text.match(LABEL);
  if (!match) return inline(text);

  return (
    <>
      <strong className="rich-label">{match[1]}</strong> {inline(text.slice(match[0].length))}
    </>
  );
};

function RichText({ text }) {
  if (!text || !text.trim()) return null;

  const blocks = text.trim().split(/\n\s*\n/);

  return (
    <div className="rich">
      {blocks.map((block, index) => {
        const lines = block.split("\n");

        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={index}>
              {lines.map((l, i) => (
                <li key={i}>{line(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index}>
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line(l)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default RichText;