import { m } from "motion/react";

// The numbered grid of bubbles: answered, marked for review, current.
// In "total time" mode a click jumps to that question.
// In "per question" mode it only shows progress, because students cannot go back.
function QuestionNavigator({
  questions,
  answers,
  marked,
  mode,
  currentIndex,
  onJump,
}) {
  const perQuestion = mode === "perQuestion";
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined
  ).length;
  const markedCount = questions.filter((q) => marked[q.id]).length;

  return (
    <div className="navigator-rail">
      <nav className="navigator" aria-label="Question navigator">
        <p className="navigator-title">Questions</p>

        <div className="navigator-grid">
          {questions.map((q, index) => {
            const answered = answers[q.id] !== undefined;
            const isMarked = Boolean(marked[q.id]);
            const isCurrent = perQuestion && index === currentIndex;
            const skipped = perQuestion && index < currentIndex && !answered;

            const classes = [
              "nav-cell",
              answered && "answered",
              isMarked && "marked",
              isCurrent && "current",
              skipped && "skipped",
            ]
              .filter(Boolean)
              .join(" ");

            const label = `Question ${index + 1}, ${
              answered ? "answered" : "not answered"
            }${isMarked ? ", marked for review" : ""}`;

            return (
              <m.button
                key={q.id}
                type="button"
                className={classes}
                disabled={perQuestion}
                aria-label={label}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onJump(q.id)}
                animate={answered ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.28 }}
                whileTap={perQuestion ? undefined : { scale: 0.92 }}
              >
                {index + 1}
              </m.button>
            );
          })}
        </div>

        <p className="navigator-count">
          {answeredCount} of {questions.length} answered
          {!perQuestion && markedCount > 0
            ? `, ${markedCount} marked for review`
            : ""}
        </p>

        <ul className="navigator-legend">
          <li>
            <span className="legend-dot answered" /> Answered
          </li>
          <li>
            <span className="legend-dot" />{" "}
            {perQuestion ? "Not yet reached" : "Not answered"}
          </li>
          {perQuestion ? (
            <li>
              <span className="legend-dot skipped" /> Skipped
            </li>
          ) : (
            <li>
              <span className="legend-dot marked" /> Marked for review
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

export default QuestionNavigator;