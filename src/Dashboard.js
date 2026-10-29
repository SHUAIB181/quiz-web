import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "./teacherApi";
import "./Teacher.css";

const formatSeconds = (total) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds}s`;
};

function Dashboard({ onLogout }) {
  const [results, setResults] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");

  // Timer settings form
  const [mode, setMode] = useState("total");
  const [totalMinutes, setTotalMinutes] = useState("3");
  const [totalSecs, setTotalSecs] = useState("0");
  const [defaultSecs, setDefaultSecs] = useState("30");
  const [settingsMessage, setSettingsMessage] = useState(null);

  // Editing the time of one question
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  // An expired session sends the teacher back to the login screen
  const handleFailure = (error, text) => {
    if (error.response && error.response.status === 401) {
      if (onLogout) onLogout();
      return;
    }
    setNotice({ type: "error", text });
  };

  useEffect(() => {
    Promise.all([
      api.get("/results"),
      api.get("/teacher/questions"),
      api.get("/teacher/settings"),
    ])
      .then(([resultsResponse, questionsResponse, settingsResponse]) => {
        const saved = settingsResponse.data;
        setResults(resultsResponse.data);
        setQuestions(questionsResponse.data);
        setSettings(saved);
        setMode(saved.mode);
        setTotalMinutes(String(Math.floor(saved.totalSeconds / 60)));
        setTotalSecs(String(saved.totalSeconds % 60));
        setDefaultSecs(String(saved.defaultQuestionSeconds));
      })
      .catch((error) =>
        handleFailure(
          error,
          "Could not load the dashboard. Check that the server is running."
        )
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportResults = async () => {
    try {
      const response = await api.get("/export-results", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "results.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleFailure(error, "Could not export the results.");
    }
  };

  const clearResults = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete all results?"
    );
    if (!confirmed) return;

    try {
      await api.delete("/clear-results");
      setResults([]);
      setNotice({ type: "success", text: "All results were cleared." });
    } catch (error) {
      handleFailure(error, "Could not clear the results.");
    }
  };

  const deleteQuestion = async (q) => {
    const confirmed = window.confirm(
      `Delete this question?\n\n${q.question}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/questions/${q.id}`);
      setQuestions((current) => current.filter((item) => item.id !== q.id));
      setNotice({ type: "success", text: "Question deleted." });
    } catch (error) {
      handleFailure(error, "Could not delete the question.");
    }
  };

  // ----- Timer settings -----
  const saveSettings = async () => {
    const totalSeconds = Number(totalMinutes) * 60 + Number(totalSecs);
    const defaultQuestionSeconds = Number(defaultSecs);

    if (
      !Number.isInteger(totalSeconds) ||
      totalSeconds < 10 ||
      totalSeconds > 10800
    ) {
      setSettingsMessage({
        type: "error",
        text: "Total time must be between 10 seconds and 3 hours.",
      });
      return;
    }
    if (
      !Number.isInteger(defaultQuestionSeconds) ||
      defaultQuestionSeconds < 5 ||
      defaultQuestionSeconds > 3600
    ) {
      setSettingsMessage({
        type: "error",
        text: "Time per question must be between 5 and 3600 seconds.",
      });
      return;
    }

    try {
      await api.put("/teacher/settings", {
        mode,
        totalSeconds,
        defaultQuestionSeconds,
      });
      setSettings({ mode, totalSeconds, defaultQuestionSeconds });
      setSettingsMessage({
        type: "success",
        text: "Timer settings saved. They apply to quizzes that start from now on.",
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      setSettingsMessage({
        type: "error",
        text: "Could not save the timer settings.",
      });
    }
  };

  // ----- Time of a single question -----
  const defaultSeconds = settings ? settings.defaultQuestionSeconds : 30;

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditValue(String(q.timeSeconds || defaultSeconds));
  };

  const saveTime = async (q) => {
    const seconds = Number(editValue);

    if (!Number.isInteger(seconds) || seconds < 5 || seconds > 3600) {
      setNotice({
        type: "error",
        text: "Time must be a whole number of seconds between 5 and 3600.",
      });
      return;
    }

    try {
      await api.patch(`/questions/${q.id}`, { timeSeconds: seconds });
      setQuestions((current) =>
        current.map((item) =>
          item.id === q.id ? { ...item, timeSeconds: seconds } : item
        )
      );
      setEditingId(null);
      setNotice({
        type: "success",
        text: `Time for this question is now ${formatSeconds(seconds)}.`,
      });
    } catch (error) {
      handleFailure(error, "Could not save the time.");
    }
  };

  const useDefaultTime = async (q) => {
    try {
      await api.patch(`/questions/${q.id}`, { timeSeconds: null });
      setQuestions((current) =>
        current.map((item) => {
          if (item.id !== q.id) return item;
          const { timeSeconds, ...rest } = item;
          return rest;
        })
      );
      setEditingId(null);
      setNotice({
        type: "success",
        text: "This question now uses the default time.",
      });
    } catch (error) {
      handleFailure(error, "Could not reset the time.");
    }
  };

  const scores = results.map((student) => student.score);
  const average =
    scores.length > 0
      ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2)
      : 0;
  const highest = scores.length > 0 ? Math.max(...scores) : 0;
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;

  const filteredQuestions = questions.filter((q) =>
    `${q.question} ${q.category || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="teacher-page">
      <div className="t-shell">
        <div className="t-header">
          <h1>Teacher dashboard</h1>
          <div className="t-actions">
            <Link className="t-btn" to="/teacher/add-question">
              Add question
            </Link>
            <button className="t-btn ghost" onClick={exportResults}>
              Export results
            </button>
            <button className="t-btn danger" onClick={clearResults}>
              Clear results
            </button>
            {onLogout && (
              <button className="t-btn ghost" onClick={onLogout}>
                Log out
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div className={`t-notice ${notice.type}`}>{notice.text}</div>
        )}

        <div className="t-stats">
          <div className="t-stat">
            <p className="t-stat-label">Total students</p>
            <p className="t-stat-value">{results.length}</p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Average score</p>
            <p className="t-stat-value">{average}</p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Highest score</p>
            <p className="t-stat-value">{highest}</p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Lowest score</p>
            <p className="t-stat-value">{lowest}</p>
          </div>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Quiz timer</h2>
          <p className="t-section-sub">
            Choose how the quiz is timed. Changes apply to quizzes that start
            after you save.
          </p>

          {settingsMessage && (
            <div className={`t-notice ${settingsMessage.type}`}>
              {settingsMessage.text}
            </div>
          )}

          <label className={`t-mode ${mode === "total" ? "active" : ""}`}>
            <input
              type="radio"
              name="timer-mode"
              checked={mode === "total"}
              onChange={() => setMode("total")}
            />
            <span>
              <strong>Total time</strong>
              <br />
              One countdown for the whole quiz. Students can answer the
              questions in any order.
            </span>
          </label>

          <label className={`t-mode ${mode === "perQuestion" ? "active" : ""}`}>
            <input
              type="radio"
              name="timer-mode"
              checked={mode === "perQuestion"}
              onChange={() => setMode("perQuestion")}
            />
            <span>
              <strong>Time per question</strong>
              <br />
              Each question has its own countdown and there is no total time.
              Students see one question at a time and cannot go back.
            </span>
          </label>

          {mode === "total" && (
            <div className="t-time-row">
              <div className="t-field">
                <label htmlFor="total-minutes">Minutes</label>
                <input
                  id="total-minutes"
                  className="t-input t-input-small"
                  type="number"
                  min="0"
                  max="180"
                  value={totalMinutes}
                  onChange={(e) => setTotalMinutes(e.target.value)}
                />
              </div>
              <div className="t-field">
                <label htmlFor="total-seconds">Seconds</label>
                <input
                  id="total-seconds"
                  className="t-input t-input-small"
                  type="number"
                  min="0"
                  max="59"
                  value={totalSecs}
                  onChange={(e) => setTotalSecs(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === "perQuestion" && (
            <div className="t-field">
              <label htmlFor="default-seconds">
                Default time per question (seconds)
              </label>
              <input
                id="default-seconds"
                className="t-input t-input-small"
                type="number"
                min="5"
                max="3600"
                value={defaultSecs}
                onChange={(e) => setDefaultSecs(e.target.value)}
              />
              <p className="t-section-sub" style={{ margin: "8px 0 0" }}>
                Questions without their own time use this. To give one question
                a different time, use Edit time in the question bank below.
              </p>
            </div>
          )}

          <button className="t-btn" onClick={saveSettings}>
            Save timer settings
          </button>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Student results</h2>
          <p className="t-section-sub">Every quiz submission.</p>

          <div className="t-table-wrap">
            <table className="t-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {!loading && results.length === 0 && (
                  <tr>
                    <td colSpan="3" className="t-empty">
                      No submissions yet. Results appear here after a student
                      finishes the quiz.
                    </td>
                  </tr>
                )}
                {results.map((student, index) => (
                  <tr key={index}>
                    <td>{student.name}</td>
                    <td>
                      <span className="t-score">
                        {student.total
                          ? `${student.score}/${student.total}`
                          : student.score}
                      </span>
                    </td>
                    <td>
                      {student.submittedAt
                        ? new Date(student.submittedAt).toLocaleString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="t-card">
          <div className="t-toolbar">
            <div>
              <h2 className="t-section-title">Question bank</h2>
              <p className="t-section-sub" style={{ marginBottom: 0 }}>
                {filteredQuestions.length} of {questions.length} questions
              </p>
            </div>
            <input
              className="t-input"
              placeholder="Search by question or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {settings && settings.mode === "total" && (
            <p className="t-section-sub">
              The quiz is using total time right now, so the times below are
              not used. Switch to Time per question to use them.
            </p>
          )}

          <div className="t-table-wrap">
            <table className="t-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Question</th>
                  <th>Options</th>
                  <th>Answer</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && questions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="t-empty">
                      No questions yet. Use Add question to create the first
                      one.
                    </td>
                  </tr>
                )}
                {questions.length > 0 && filteredQuestions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="t-empty">
                      No questions match your search.
                    </td>
                  </tr>
                )}
                {filteredQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.category}</td>
                    <td>{q.question}</td>
                    <td>{q.options.join(", ")}</td>
                    <td>{q.answer}</td>
                    <td>
                      {editingId === q.id ? (
                        <div className="t-inline">
                          <input
                            className="t-input t-input-small"
                            type="number"
                            min="5"
                            max="3600"
                            value={editValue}
                            aria-label="Seconds for this question"
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                          <span>sec</span>
                        </div>
                      ) : q.timeSeconds ? (
                        formatSeconds(q.timeSeconds)
                      ) : (
                        `${formatSeconds(defaultSeconds)} (default)`
                      )}
                    </td>
                    <td>
                      <div className="t-cell-actions">
                        {editingId === q.id ? (
                          <>
                            <button
                              className="t-btn small"
                              onClick={() => saveTime(q)}
                            >
                              Save
                            </button>
                            <button
                              className="t-btn ghost small"
                              onClick={() => useDefaultTime(q)}
                            >
                              Use default
                            </button>
                            <button
                              className="t-btn ghost small"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="t-btn ghost small"
                              onClick={() => startEdit(q)}
                            >
                              Edit time
                            </button>
                            <button
                              className="t-btn danger small"
                              onClick={() => deleteQuestion(q)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;