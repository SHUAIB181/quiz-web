import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { m } from "motion/react";
import MathText from "./MathText";
import RichText from "./Richtext";
import Button from "./Button";

// The page students open after the quiz: every question, its answer and the written solution.
// The server only sends it once the teacher has released it.
function Solutions() {
  const [state, setState] = useState("loading"); // loading | locked | error | ready
  const [questions, setQuestions] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    axios
      .get("/api/solutions")
      .then((response) => {
        setQuestions(response.data);
        setState("ready");
      })
      .catch((error) =>
        setState(error.response && error.response.status === 403 ? "locked" : "error")
      );
  }, []);

  const numbered = questions.map((q, index) => ({ ...q, number: index + 1 }));
  const categories = [
    "All",
    ...Array.from(new Set(questions.map((q) => q.category).filter(Boolean))),
  ];

  const shown = numbered.filter((q) => {
    const matchesCategory = category === "All" || q.category === category;
    const words = `${q.question} ${q.options.join(" ")} ${q.explanation || ""}`.toLowerCase();
    return matchesCategory && words.includes(search.toLowerCase());
  });

  return (
    <div className="exam-page">
      <header className="exam-bar">
        <div className="exam-brand">
          <span className="exam-seal" aria-hidden="true" />
          Online examination
        </div>
        <div className="solutions-actions">
          <Link className="btn-ghost" to="/">
            Back to the quiz
          </Link>
          {state === "ready" && (
            <Button className="btn-ghost" onClick={() => window.print()}>
              Print or save as PDF
            </Button>
          )}
        </div>
      </header>

      <div className="quiz-container solutions-sheet">
        <h1 className="quiz-title">Detailed solutions</h1>

        {state === "loading" && <p className="solutions-intro">Loading the solutions...</p>}

        {state === "locked" && (
          <div className="solutions-lock">
            <p className="modal-title">Not released yet</p>
            <p className="solutions-intro">
              Your teacher will release the solutions after the session. Check back then.
            </p>
          </div>
        )}

        {state === "error" && (
          <p className="error-text">
            Could not load the solutions. Check your connection and reload the page.
          </p>
        )}

        {state === "ready" && (
          <>
            <p className="solutions-intro">
              Every question with the correct answer and a step-by-step solution.{" "}
              {questions.length} question{questions.length === 1 ? "" : "s"}.
            </p>

            <div className="solutions-toolbar">
              {categories.length > 2 &&
                categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`chip ${category === name ? "on" : ""}`}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              <input
                className="name-input solutions-search"
                type="search"
                placeholder="Search the solutions"
                aria-label="Search the solutions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {shown.length === 0 && <p className="solutions-intro">Nothing matches your search.</p>}

            {shown.map((q, index) => (
              <m.article
                key={q.id}
                className="solution-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
              >
                <div className="solution-head">
                  <span className="solution-number">Question {q.number}</span>
                  {q.category && <span className="solution-category">{q.category}</span>}
                </div>

                <h3 className="solution-question">
                  <MathText text={q.question} />
                </h3>

                <ol className="solution-options">
                  {q.options.map((option, i) => (
                    <li
                      key={i}
                      className={`solution-option ${option === q.answer ? "correct" : ""}`}
                    >
                      <span className="option-letter" aria-hidden="true">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>
                        <MathText text={option} />
                      </span>
                      {option === q.answer && (
                        <span className="solution-correct-tag">Correct answer</span>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="solution-body">
                  <p className="solution-heading">Solution</p>
                  {q.explanation ? (
                    <RichText text={q.explanation} />
                  ) : (
                    <p className="solution-empty">No written solution was added for this question.</p>
                  )}
                </div>
              </m.article>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default Solutions;