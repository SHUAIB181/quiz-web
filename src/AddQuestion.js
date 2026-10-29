import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "./teacherApi";
import "./Teacher.css";

function AddQuestion() {
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState("");
  const [timeSeconds, setTimeSeconds] = useState("");
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
    } catch (error) {
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
              className="t-input"
              placeholder="Type the question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setMessage(null);
              }}
            />
          </div>

          <div className="t-grid-2">
            {options.map((value, i) => (
              <div className="t-field" key={i}>
                <label htmlFor={`q-opt-${i}`}>Option {labels[i]}</label>
                <input
                  id={`q-opt-${i}`}
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

          <button className="t-btn full" onClick={saveQuestion}>
            Save question
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddQuestion;