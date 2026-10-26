import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "./teacherApi";
import "./Teacher.css";

function Dashboard({ onLogout }) {
  const [results, setResults] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");

  // An expired session sends the teacher back to the login screen
  const handleFailure = (error, text) => {
    if (error.response && error.response.status === 401) {
      if (onLogout) onLogout();
      return;
    }
    setNotice({ type: "error", text });
  };

  useEffect(() => {
    Promise.all([api.get("/results"), api.get("/teacher/questions")])
      .then(([resultsResponse, questionsResponse]) => {
        setResults(resultsResponse.data);
        setQuestions(questionsResponse.data);
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
                      <span className="t-score">{student.score}</span>
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

          <div className="t-table-wrap">
            <table className="t-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Question</th>
                  <th>Options</th>
                  <th>Answer</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && questions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="t-empty">
                      No questions yet. Use Add question to create the first
                      one.
                    </td>
                  </tr>
                )}
                {questions.length > 0 && filteredQuestions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="t-empty">
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
                      <button
                        className="t-btn danger small"
                        onClick={() => deleteQuestion(q)}
                      >
                        Delete
                      </button>
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