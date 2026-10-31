import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "./teacherApi";
import "./Teacher.css";
import MathText from "./MathText";
import Button from "./Button";

// Buttons for the formula toolbar. The cursor lands inside the first { }.
const SYMBOLS = [
  { label: "\u221A", title: "Square root", snippet: "$\\sqrt{}$" },
  { label: "a/b", title: "Fraction", snippet: "$\\frac{}{}$" },
  { label: "x\u00B2", title: "Power", snippet: "$x^{}$" },
  { label: "x\u2081", title: "Subscript", snippet: "$x_{}$" },
  { label: "\u03C0", title: "Pi", snippet: "$\\pi$" },
  { label: "\u03B8", title: "Theta", snippet: "$\\theta$" },
  { label: "\u00D7", title: "Times", snippet: "$\\times$" },
  { label: "\u00F7", title: "Divide", snippet: "$\\div$" },
  { label: "\u00B1", title: "Plus or minus", snippet: "$\\pm$" },
  { label: "\u2264", title: "Less than or equal", snippet: "$\\le$" },
  { label: "\u2265", title: "Greater than or equal", snippet: "$\\ge$" },
  { label: "\u2260", title: "Not equal", snippet: "$\\ne$" },
  { label: "\u221E", title: "Infinity", snippet: "$\\infty$" },
  { label: "\u00B0", title: "Degrees", snippet: "$^{\\circ}$" },
  { label: "\u03A3", title: "Sum", snippet: "$\\sum$" },
  { label: "\u222B", title: "Integral", snippet: "$\\int$" },
];

function AddQuestion() {
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState("");
  const [timeSeconds, setTimeSeconds] = useState("");
  const [activeField, setActiveField] = useState("question");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fieldRefs = useRef({});
  const [message, setMessage] = useState(null);

  const labels = ["A", "B", "C", "D"];

  // Only signed-in teachers can see this page
  if (!sessionStorage.getItem("teacherToken")) {
    return <Navigate to="/teacher" replace />;
  }

  const setOption = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
    setMessage(null);
  };

  // Put a formula snippet into the box the teacher last clicked
  const insertSnippet = (snippet) => {
    const key = activeField;
    const el = fieldRefs.current[key];
    const current = key === "question" ? question : options[key];
    const start = el ? el.selectionStart : current.length;
    const end = el ? el.selectionEnd : current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);

    if (key === "question") {
      setQuestion(next);
    } else {
      setOption(key, next);
    }

    const inner = snippet.indexOf("{}");
    const caret = start + (inner >= 0 ? inner + 1 : snippet.length);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
    setMessage(null);
  };

  const saveQuestion = async () => {
    if (!question.trim()) {
      setMessage({ type: "error", text: "Enter the question text." });
      return;
    }
    if (options.some((o) => !o.trim())) {
      setMessage({ type: "error", text: "Fill in all four options." });
      return;
    }
    if (correct === "") {
      setMessage({ type: "error", text: "Choose the correct option." });
      return;
    }

    setSaving(true);
    try {
      await api.post("/add-question", {
        category,
        question,
        options,
        answer: options[Number(correct)],
        ...(timeSeconds ? { timeSeconds: Number(timeSeconds) } : {}),
      });

      setMessage({
        type: "success",
        text: "Question added. Students will see it the next time they open the quiz.",
      });
      setCategory("");
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrect("");
      setTimeSeconds("");
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (error) {
      setSaving(false);
      const status = error.response && error.response.status;
      setMessage({
        type: "error",
        text:
          status === 401
            ? "Your session expired. Go back and sign in again."
            : status === 400
            ? "The question was not accepted. Check every field, and keep the time between 5 and 3600 seconds."
            : "Could not save the question. Check that the server is running.",
      });
    }
  };

  return (
    <div className="teacher-page">
      <div className="t-shell narrow">
        <div className="t-card">
          <p style={{ margin: "0 0 16px" }}>
            <Link className="t-btn ghost small" to="/teacher">
              Back to dashboard
            </Link>
          </p>
          <h1 className="t-title">Add question</h1>
          <p className="t-sub">Write the question, four options, and mark the right one.</p>

          {message && (
            <div className={`t-notice ${message.type}`}>{message.text}</div>
          )}

          <div className="t-field">
            <label htmlFor="q-category">Category</label>
            <input
              id="q-category"
              className="t-input"
              placeholder="For example, Maths"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="t-field">
            <label htmlFor="q-text">Question</label>
            <input
              id="q-text"
              ref={(el) => (fieldRefs.current.question = el)}
              onFocus={() => setActiveField("question")}
              className="t-input"
              placeholder="Type the question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setMessage(null);
              }}
            />
          </div>

          <div className="formula-bar" role="toolbar" aria-label="Maths symbols">
            <span className="formula-hint">
              Click a box, then a symbol. Formulas sit between $ signs.
            </span>
            {SYMBOLS.map((symbol) => (
              <button
                key={symbol.title}
                type="button"
                className="formula-btn"
                title={symbol.title}
                aria-label={symbol.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertSnippet(symbol.snippet)}
              >
                {symbol.label}
              </button>
            ))}
          </div>

          <div className="t-grid-2">
            {options.map((value, i) => (
              <div className="t-field" key={i}>
                <label htmlFor={`q-opt-${i}`}>Option {labels[i]}</label>
                <input
                  id={`q-opt-${i}`}
                  ref={(el) => (fieldRefs.current[i] = el)}
                  onFocus={() => setActiveField(i)}
                  className="t-input"
                  placeholder={`Option ${labels[i]}`}
                  value={value}
                  onChange={(e) => setOption(i, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="t-field">
            <label htmlFor="q-correct">Correct option</label>
            <select
              id="q-correct"
              className="t-select"
              value={correct}
              onChange={(e) => {
                setCorrect(e.target.value);
                setMessage(null);
              }}
            >
              <option value="">Select the correct option</option>
              {options.map((value, i) => (
                <option key={i} value={i}>
                  {labels[i]}
                  {value ? `: ${value}` : ""}
                </option>
              ))}
            </select>
          </div>

          {question.trim() && (
            <div className="formula-preview">
              <p className="formula-preview-title">How students will see it</p>
              <p className="formula-preview-question">
                <MathText text={question} />
              </p>
              {options.map(
                (value, i) =>
                  value.trim() && (
                    <p className="formula-preview-option" key={i}>
                      <span className="option-letter" aria-hidden="true">
                        {labels[i]}
                      </span>
                      <MathText text={value} />
                    </p>
                  )
              )}
            </div>
          )}

          <div className="t-field">
            <label htmlFor="q-time">Time for this question (seconds, optional)</label>
            <input
              id="q-time"
              className="t-input"
              type="number"
              min="5"
              max="3600"
              placeholder="Leave empty to use the default time"
              value={timeSeconds}
              onChange={(e) => setTimeSeconds(e.target.value)}
            />
            <p className="t-section-sub" style={{ margin: "6px 0 0" }}>
              Only used when the quiz is set to Time per question.
            </p>
          </div>

          <Button
            className="t-btn full"
            onClick={saveQuestion}
            status={saving ? "loading" : saved ? "done" : "idle"}
          >
            Save question
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AddQuestion;