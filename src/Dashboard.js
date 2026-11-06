import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "./teacherApi";
import "./Teacher.css";
import MathText from "./MathText";
import CountUp from "./CountUp";
import Modal from "./Modal";
import Button from "./Button";
import RichText from "./Richtext";
import { AnimatePresence, m } from "motion/react";

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
  const [pending, setPending] = useState(null); // what the popup is asking about
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [solutionEdit, setSolutionEdit] = useState(null); // { id, text } while writing a solution
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [protection, setProtection] = useState({
    enabled: false,
    maxWarnings: 3,
    requireFullscreen: false,
    watermark: true,
  });
  const [maxWarningsInput, setMaxWarningsInput] = useState("3");
  const [protectionSaved, setProtectionSaved] = useState(false);

  // Timer settings form
  const [mode, setMode] = useState("total");
  const [totalMinutes, setTotalMinutes] = useState("3");
  const [totalSecs, setTotalSecs] = useState("0");
  const [defaultSecs, setDefaultSecs] = useState("30");
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

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
        setSolutionsOpen(Boolean(saved.solutionsOpen));
        setTimerEnabled(saved.timerEnabled !== false);
        if (saved.protection) {
          setProtection(saved.protection);
          setMaxWarningsInput(String(saved.protection.maxWarnings));
        }
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
    try {
      await api.delete("/clear-results");
      setResults([]);
      setNotice({ type: "success", text: "All results were cleared." });
    } catch (error) {
      handleFailure(error, "Could not clear the results.");
    }
  };

  const deleteQuestion = async (q) => {
    try {
      await api.delete(`/questions/${q.id}`);
      setQuestions((current) => current.filter((item) => item.id !== q.id));
      setNotice({ type: "success", text: "Question deleted." });
    } catch (error) {
      handleFailure(error, "Could not delete the question.");
    }
  };

  const toggleSolutions = async () => {
    try {
      await api.put("/teacher/solutions-access", { open: !solutionsOpen });
      setSolutionsOpen(!solutionsOpen);
      setNotice({
        type: "success",
        text: solutionsOpen
          ? "Solutions are hidden again."
          : "Solutions are released. Students can open the Solutions page now.",
      });
    } catch (error) {
      handleFailure(error, "Could not change the solutions setting.");
    }
  };

  const copySolutionsLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/solutions`);
      setNotice({ type: "success", text: "Link copied." });
    } catch (error) {
      setNotice({ type: "error", text: "Could not copy. Select the link and copy it by hand." });
    }
  };

  const saveSolution = async () => {
    if (!solutionEdit) return;
    const text = solutionEdit.text.trim();

    try {
      await api.patch(`/questions/${solutionEdit.id}`, {
        explanation: text === "" ? null : text,
      });
      setQuestions((current) =>
        current.map((item) => {
          if (item.id !== solutionEdit.id) return item;
          if (text === "") {
            const { explanation, ...rest } = item;
            return rest;
          }
          return { ...item, explanation: text };
        })
      );
      setSolutionEdit(null);
      setNotice({ type: "success", text: "Solution saved." });
    } catch (error) {
      handleFailure(error, "Could not save the solution.");
    }
  };

  // ----- Timer on/off and protection -----
  const saveControls = async (body, doneText, applyLocally) => {
    try {
      await api.put("/teacher/exam-controls", body);
      applyLocally();
      setNotice({ type: "success", text: doneText });
    } catch (error) {
      handleFailure(error, "Could not save that setting.");
    }
  };

  const toggleTimer = () =>
    saveControls(
      { timerEnabled: !timerEnabled },
      timerEnabled
        ? "Timer turned off. Students have no time limit."
        : "Timer turned on again.",
      () => setTimerEnabled(!timerEnabled)
    );

  const toggleProtection = () =>
    saveControls(
      { protection: { enabled: !protection.enabled } },
      protection.enabled
        ? "Protection turned off."
        : "Protection turned on. It applies to quizzes that start from now on.",
      () => setProtection((current) => ({ ...current, enabled: !current.enabled }))
    );

  const saveProtection = () => {
    const maxWarnings = Number(maxWarningsInput);

    if (!Number.isInteger(maxWarnings) || maxWarnings < 1 || maxWarnings > 10) {
      setNotice({
        type: "error",
        text: "Warnings allowed must be a whole number from 1 to 10.",
      });
      return Promise.resolve();
    }

    return saveControls(
      {
        protection: {
          maxWarnings,
          requireFullscreen: protection.requireFullscreen,
          watermark: protection.watermark,
        },
      },
      "Protection options saved.",
      () => {
        setProtection((current) => ({ ...current, maxWarnings }));
        setProtectionSaved(true);
        setTimeout(() => setProtectionSaved(false), 1600);
      }
    );
  };

  const confirmPending = async () => {
    const item = pending;
    setPending(null);
    if (!item) return;
    if (item.kind === "results") {
      await clearResults();
    } else {
      await deleteQuestion(item.q);
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
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 1600);
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

  const resetToDefaultTime = async (q) => {
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

  // keep the popup's words while it fades out
  const pendingRef = useRef(null);
  if (pending) pendingRef.current = pending;
  const view = pendingRef.current;

  // keep the solution popup's words while it fades out
  const editRef = useRef(null);
  if (solutionEdit) editRef.current = solutionEdit;
  const editView = editRef.current;

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
        <Modal
          open={pending !== null}
          onClose={() => setPending(null)}
          tone="danger"
          title={
            view && view.kind === "question"
              ? "Delete this question?"
              : "Clear all results?"
          }
        >
          {view && view.kind === "question" && (
            <p className="modal-quote">
              <MathText text={view.q.question} />
            </p>
          )}
          <p className="modal-body">
            {view && view.kind === "question"
              ? "This cannot be undone."
              : "Every student's result will be removed. This cannot be undone."}
          </p>
          <div className="modal-actions">
            <Button
              type="button"
              className="t-btn ghost"
              data-autofocus
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button type="button" className="t-btn danger" onClick={confirmPending}>
              {view && view.kind === "question" ? "Delete question" : "Clear results"}
            </Button>
          </div>
        </Modal>

        <Modal
          open={solutionEdit !== null}
          onClose={() => setSolutionEdit(null)}
          title="Written solution"
        >
          <p className="modal-body">
            Explain it step by step. A blank line starts a new paragraph, a line starting with "- "
            is a bullet, **bold** works, and formulas go between $ signs.
          </p>
          <textarea
            className="t-input solution-input"
            rows={10}
            data-autofocus
            placeholder={"Step 1: ...\n\nStep 2: ..."}
            value={editView ? editView.text : ""}
            onChange={(e) =>
              setSolutionEdit((current) =>
                current ? { ...current, text: e.target.value } : current
              )
            }
          />
          {editView && editView.text.trim() && (
            <div className="solution-preview">
              <p className="formula-preview-title">How it will read</p>
              <RichText text={editView.text} />
            </div>
          )}
          <div className="modal-actions">
            <Button type="button" className="t-btn ghost" onClick={() => setSolutionEdit(null)}>
              Cancel
            </Button>
            <Button type="button" className="t-btn" onClick={saveSolution}>
              Save solution
            </Button>
          </div>
        </Modal>

        <div className="t-header">
          <h1>Teacher dashboard</h1>
          <div className="t-actions">
            <Link className="t-btn" to="/teacher/add-question">
              Add question
            </Link>
            <Link className="t-btn ghost" to="/teacher/import">
              Import questions
            </Link>
            <Button className="t-btn ghost" onClick={exportResults}>
              Export results
            </Button>
            <Button className="t-btn danger" onClick={() => setPending({ kind: "results" })}>
              Clear results
            </Button>
            {onLogout && (
              <Button className="t-btn ghost" onClick={onLogout}>
                Log out
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {notice && (
            <m.div
              key={notice.text}
              className={`t-notice ${notice.type}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {notice.text}
            </m.div>
          )}
        </AnimatePresence>

        <div className="t-stats">
          <div className="t-stat">
            <p className="t-stat-label">Total students</p>
            <p className="t-stat-value">
              <CountUp to={results.length} />
            </p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Average score</p>
            <p className="t-stat-value">{average}</p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Highest score</p>
            <p className="t-stat-value">
              <CountUp to={highest} />
            </p>
          </div>
          <div className="t-stat">
            <p className="t-stat-label">Lowest score</p>
            <p className="t-stat-value">
              <CountUp to={lowest} />
            </p>
          </div>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Exam controls</h2>
          <p className="t-section-sub">
            Two switches for a quiz. They apply to quizzes that students start after you press them.
          </p>

          <div className="control-row">
            <div>
              <p className="control-title">Timer</p>
              <p className="control-text">
                When the timer is off there is no time limit, and students answer at their own pace.
                Your timer settings are kept for when you turn it back on.
              </p>
            </div>
            <span className={`status-pill ${timerEnabled ? "open" : "closed"}`}>
              {timerEnabled ? "On" : "Off"}
            </span>
            <Button className="t-btn" onClick={toggleTimer}>
              {timerEnabled ? "Turn timer off" : "Turn timer on"}
            </Button>
          </div>

          <div className="control-row">
            <div>
              <p className="control-title">Protection against malpractice</p>
              <p className="control-text">
                Watches for a student leaving the quiz window or switching tabs, warns them, records
                each warning next to their result, and submits the quiz automatically after the
                warnings you allow.
              </p>
            </div>
            <span className={`status-pill ${protection.enabled ? "open" : "closed"}`}>
              {protection.enabled ? "On" : "Off"}
            </span>
            <Button className="t-btn" onClick={toggleProtection}>
              {protection.enabled ? "Turn protection off" : "Turn protection on"}
            </Button>
          </div>

          <div className="protection-options">
            <div className="t-field">
              <label htmlFor="max-warnings">Warnings allowed before the quiz is submitted automatically</label>
              <input
                id="max-warnings"
                className="t-input t-input-small"
                type="number"
                min="1"
                max="10"
                value={maxWarningsInput}
                onChange={(e) => setMaxWarningsInput(e.target.value)}
              />
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={protection.requireFullscreen}
                onChange={(e) =>
                  setProtection((current) => ({ ...current, requireFullscreen: e.target.checked }))
                }
              />
              <span>
                Require full screen (laptops and desktops). Leaving full screen counts as leaving the
                window. Phones and iPads usually cannot do this.
              </span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={protection.watermark}
                onChange={(e) =>
                  setProtection((current) => ({ ...current, watermark: e.target.checked }))
                }
              />
              <span>
                Show the student's name faintly across the page, so a leaked screenshot can be traced.
              </span>
            </label>

            <Button
              className="t-btn ghost"
              onClick={saveProtection}
              status={protectionSaved ? "done" : "idle"}
            >
              Save protection options
            </Button>
          </div>

          <p className="control-text" style={{ marginTop: 16 }}>
            <strong>What protection can and cannot do.</strong> It can detect leaving the window, warn
            and record it, turn off copy, right-click and printing, hide the quiz whenever the window
            loses focus, and react to the Print Screen key. It <strong>cannot</strong> stop a
            screenshot, a photo of the screen with another phone, or a second device. The record comes
            from the student's browser, so treat it as a warning sign and not as proof. For a graded
            exam, also watch the session on a video call.
          </p>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Solutions page</h2>
          <p className="t-section-sub">
            Students read every question with its answer and written solution on a separate page.
            Keep it hidden while they attempt the quiz, then release it. The server holds the
            solutions back until you do.
          </p>
          <div className="solutions-status">
            <span className={`status-pill ${solutionsOpen ? "open" : "closed"}`}>
              {solutionsOpen ? "Released" : "Hidden"}
            </span>
            <Button className="t-btn" onClick={toggleSolutions}>
              {solutionsOpen ? "Hide solutions" : "Release solutions"}
            </Button>
          </div>
          <div className="solutions-link-row">
            <code>{`${window.location.origin}/solutions`}</code>
            <Button className="t-btn ghost small" onClick={copySolutionsLink}>
              Copy link
            </Button>
          </div>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Quiz timer</h2>
          {!timerEnabled && (
            <div className="t-notice error">
              The timer is turned off, so these settings are not used until you turn it back on.
            </div>
          )}
          <p className="t-section-sub">
            Choose how the quiz is timed. Changes apply to quizzes that start
            after you save.
          </p>

          {settingsMessage && (
            <div className={`t-notice ${settingsMessage.type}`}>
              {settingsMessage.text}
            </div>
          )}

          <label className="t-mode">
            {mode === "total" && (
              <m.div
                layoutId="timer-mode"
                className="t-mode-highlight"
                style={{ borderRadius: 12 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
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

          <label className="t-mode">
            {mode === "perQuestion" && (
              <m.div
                layoutId="timer-mode"
                className="t-mode-highlight"
                style={{ borderRadius: 12 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
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

          <AnimatePresence mode="wait" initial={false}>
          {mode === "total" && (
            <m.div
              key="total-fields"
              className="t-time-row"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
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
            </m.div>
          )}

          {mode === "perQuestion" && (
            <m.div
              key="question-fields"
              className="t-field"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
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
            </m.div>
          )}
          </AnimatePresence>

          <Button
            className="t-btn"
            onClick={saveSettings}
            status={settingsSaved ? "done" : "idle"}
          >
            Save timer settings
          </Button>
        </div>

        <div className="t-card">
          <h2 className="t-section-title">Student results</h2>
          <p className="t-section-sub">Every quiz submission.</p>

          <div className="t-table-wrap">
            <table className="t-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll Number</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {!loading && results.length === 0 && (
                  <tr>
                    <td colSpan="4" className="t-empty">
                      No submissions yet. Results appear here after a student
                      finishes the quiz.
                    </td>
                  </tr>
                )}
                {results.map((student, index) => (
                  <tr key={index}>
                    <td>{student.name}</td>
                    <td>{student.rollNumber}</td>
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
                    <td>
                      {student.warnings ? (
                        <span
                          className="warn-pill"
                          title={(student.malpractice || []).map((event) => event.type).join(", ")}
                        >
                          {student.warnings}
                        </span>
                      ) : (
                        "0"
                      )}
                      {student.endedBy === "protection" && (
                        <span className="solution-badge ended">Auto-ended</span>
                      )}
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
                <AnimatePresence initial={false}>
                {filteredQuestions.map((q) => (
                  <m.tr
                    key={q.id}
                    layout="position"
                    exit={{ opacity: 0, x: 48 }}
                    transition={{ duration: 0.22 }}
                  >
                    <td>{q.category}</td>
                    <td>
                      <MathText text={q.question} />
                      {q.explanation && (
                        <span className="solution-badge">Solution added</span>
                      )}
                    </td>
                    <td>
                      {q.options.map((option, i) => (
                        <span key={i}>
                          {i > 0 ? ", " : ""}
                          <MathText text={option} />
                        </span>
                      ))}
                    </td>
                    <td>
                      <MathText text={q.answer} />
                    </td>
                    <td>
                      {editingId === q.id ? (
                        <m.div
                          className="t-inline"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
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
                        </m.div>
                      ) : q.timeSeconds ? (
                        formatSeconds(q.timeSeconds)
                      ) : (
                        `${formatSeconds(defaultSeconds)} (default)`
                      )}
                    </td>
                    <td>
                      <m.div
                        className="t-cell-actions"
                        key={editingId === q.id ? "edit" : "view"}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      >
                        {editingId === q.id ? (
                          <>
                            <Button
                              className="t-btn small"
                              onClick={() => saveTime(q)}
                            >
                              Save
                            </Button>
                            <Button
                              className="t-btn ghost small"
                              onClick={() => resetToDefaultTime(q)}
                            >
                              Use default
                            </Button>
                            <Button
                              className="t-btn ghost small"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="t-btn ghost small"
                              onClick={() => startEdit(q)}
                            >
                              Edit time
                            </Button>
                            <Button
                              className="t-btn ghost small"
                              onClick={() =>
                                setSolutionEdit({ id: q.id, text: q.explanation || "" })
                              }
                            >
                              {q.explanation ? "Edit solution" : "Add solution"}
                            </Button>
                            <Button
                              className="t-btn danger small"
                              onClick={() => setPending({ kind: "question", q })}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </m.div>
                    </td>
                  </m.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;