import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "./teacherApi";
import Button from "./Button";
import MathText from "./MathText";
import { parseQuestions, EXAMPLE } from "./Parsequestions";
import "./Teacher.css";

function ImportQuestions() {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(null); // { questions, errors }
  const [message, setMessage] = useState(null);
  const [importing, setImporting] = useState(false);

  if (!sessionStorage.getItem("teacherToken")) {
    return <Navigate to="/teacher" replace />;
  }

  const check = () => {
    setMessage(null);
    setChecked(parseQuestions(text));
  };

  const importAll = async () => {
    if (!checked || checked.errors.length > 0 || checked.questions.length === 0) return;

    setImporting(true);
    try {
      const response = await api.post("/teacher/import-questions", {
        questions: checked.questions,
      });
      setMessage({
        type: "success",
        text: `${response.data.imported} questions imported. They are in the question bank now.`,
      });
      setText("");
      setChecked(null);
    } catch (error) {
      const status = error.response && error.response.status;
      const detail = error.response && error.response.data && error.response.data.error;
      setMessage({
        type: "error",
        text:
          status === 401
            ? "Your session expired. Go back and sign in again."
            : detail || "Could not import. Check that the server is running.",
      });
    } finally {
      setImporting(false);
    }
  };

  const ready = checked && checked.errors.length === 0 && checked.questions.length > 0;

  return (
    <div className="teacher-page">
      <div className="t-shell medium">
        <div className="t-card">
          <p style={{ margin: "0 0 16px" }}>
            <Link className="t-btn ghost small" to="/teacher">
              Back to dashboard
            </Link>
          </p>
          <h1 className="t-title">Import questions</h1>
          <p className="t-sub">
            Paste many questions at once, each with its answer and written solution. Separate
            questions with a line of three dashes (---).
          </p>

          {message && <div className={`t-notice ${message.type}`}>{message.text}</div>}

          <div className="t-actions" style={{ margin: "0 0 12px" }}>
            <Button
              className="t-btn ghost small"
              onClick={() => {
                setText(EXAMPLE);
                setChecked(null);
              }}
            >
              Fill in an example
            </Button>
          </div>

          <textarea
            className="t-input import-box"
            rows={18}
            spellCheck="false"
            aria-label="Questions to import"
            placeholder={"Category: Percentages\nQ: What is 15% of 200?\nA) 20\nB) 30\nC) 40\nD) 25\nAnswer: B\nSolution:\nStep 1: ...\n---"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setChecked(null);
            }}
          />

          <p className="t-section-sub" style={{ marginTop: 8 }}>
            Each question needs <strong>Q:</strong>, four options <strong>A) B) C) D)</strong> and{" "}
            <strong>Answer:</strong> (a letter). <strong>Category:</strong>, <strong>Time:</strong>{" "}
            (seconds) and <strong>Solution:</strong> are optional. Solution must come last, and it
            can run over many lines. Write formulas between $ signs.
          </p>

          <div className="t-actions">
            <Button className="t-btn ghost" onClick={check} disabled={!text.trim()}>
              Check questions
            </Button>
            {ready && (
              <Button
                className="t-btn"
                onClick={importAll}
                disabled={importing}
                status={importing ? "loading" : "idle"}
              >
                {`Import ${checked.questions.length} question${checked.questions.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>

          {checked && checked.errors.length > 0 && (
            <div className="t-notice error import-errors">
              <strong>Fix these first:</strong>
              <ul>
                {checked.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {ready && (
            <div className="import-list">
              <p className="formula-preview-title">
                {checked.questions.length} question{checked.questions.length === 1 ? "" : "s"} found.
                Nothing is saved until you press Import.
              </p>
              <ol>
                {checked.questions.map((q, i) => (
                  <li key={i}>
                    <MathText text={q.question.split("\n")[0]} />
                    <span className="import-meta">
                      {q.category ? `${q.category}, ` : ""}
                      {q.explanation ? "with solution" : "no solution"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportQuestions;