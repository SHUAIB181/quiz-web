import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);

  // answers are saved by question id: { 1: "20", 2: "4" }
  const [answers, setAnswers] = useState({});

  // The server marks the quiz and sends back { score, total, review }
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const submittingRef = useRef(false);

  const submitted = result !== null;

  useEffect(() => {
    axios
      .get("/questions")
      .then((response) => setQuestions(response.data))
      .catch(() =>
        setLoadError("Could not load the questions. Please tell your teacher.")
      );
  }, []);

  // Count the timer down
  useEffect(() => {
    if (!quizStarted || submitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, submitted]);

  const handleAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const submitQuiz = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await axios.post("/submit", { name, answers });
      setResult(response.data);
    } catch (error) {
      setSubmitError(
        "Could not submit your quiz. Check your connection and press Submit again."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Always points at the newest submitQuiz, so the auto-submit sees the latest answers
  const submitRef = useRef(submitQuiz);
  submitRef.current = submitQuiz;

  // When time runs out, submit automatically
  useEffect(() => {
    if (quizStarted && !submitted && timeLeft === 0) {
      setTimedOut(true);
      submitRef.current();
    }
  }, [quizStarted, submitted, timeLeft]);

  if (submitted) {
    const { score, total, review } = result;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const message =
      percent >= 80
        ? "Excellent work!"
        : percent >= 50
        ? "Good effort!"
        : "Keep practicing!";

    return (
      <div className="result-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-badge">Quiz Submitted</span>
            <h1>{message}</h1>
            <p className="result-name">{name}</p>
            {timedOut && (
              <p className="review-line">
                Time ran out, so your quiz was submitted automatically.
              </p>
            )}
          </div>

          <div className="score-circle" style={{ "--pct": `${percent}%` }}>
            <div className="score-inner">
              <span className="score-number">
                {score}/{total}
              </span>
              <span className="score-percent">{percent}%</span>
            </div>
          </div>

          <h2 className="review-title">Review Answers</h2>

          {review.map((item, index) => (
            <div
              key={item.id}
              className={`review-item ${item.correct ? "correct" : "wrong"}`}
            >
              <div className="review-top">
                <span className="review-q">Question {index + 1}</span>
                <span className="review-status">
                  {item.correct ? "Correct" : "Incorrect"}
                </span>
              </div>
              <p className="review-text">{item.question}</p>
              <p className="review-line">
                Your answer: <strong>{item.yourAnswer || "Not answered"}</strong>
              </p>
              {!item.correct && item.correctAnswer && (
                <p className="review-line">
                  Correct answer: <strong>{item.correctAnswer}</strong>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <h2 className="timer">
        Time Remaining: {Math.floor(timeLeft / 60)}:
        {(timeLeft % 60).toString().padStart(2, "0")}
      </h2>
      <h1 className="quiz-title">Let's do this</h1>

      <input
        className={`name-input ${nameError ? "input-error" : ""}`}
        type="text"
        placeholder="Enter Your Name"
        value={name}
        disabled={quizStarted}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError("");
        }}
      />
      {nameError && <p className="error-text">{nameError}</p>}
      {loadError && <p className="error-text">{loadError}</p>}

      <button
        className="btn-primary"
        disabled={questions.length === 0 || loadError !== "" || quizStarted}
        onClick={() => {
          if (name.trim() === "") {
            setNameError("Please enter your name to start the quiz");
            return;
          }
          setNameError("");
          setQuizStarted(true);
        }}
      >
        Start Quiz
      </button>

      {quizStarted && (
        <>
          {questions.map((q, index) => (
            <div className="question" key={q.id}>
              <h3>
                {index + 1}. {q.question}
              </h3>

              {q.options.map((option, i) => (
                <label key={i} className="option">
                  <input
                    type="radio"
                    name={`question-${q.id}`}
                    value={option}
                    disabled={submitting || timeLeft === 0}
                    onChange={() => handleAnswer(q.id, option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          ))}

          {submitError && <p className="error-text">{submitError}</p>}

          <button
            className="btn-primary"
            onClick={submitQuiz}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </>
      )}
    </div>
  );
}

export default App;