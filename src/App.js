import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

function App() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);

  // The teacher chooses how the quiz is timed:
  //   "total"        one countdown for the whole quiz
  //   "perQuestion"  each question has its own countdown
  const [mode, setMode] = useState("total");
  const [timeLeft, setTimeLeft] = useState(180); // total mode
  const [currentIndex, setCurrentIndex] = useState(0); // per-question mode
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0); // per-question mode

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
    Promise.all([axios.get("/questions"), axios.get("/quiz-settings")])
      .then(([questionsResponse, settingsResponse]) => {
        setQuestions(questionsResponse.data);
        setMode(settingsResponse.data.mode);
        setTimeLeft(settingsResponse.data.totalSeconds);
      })
      .catch(() =>
        setLoadError("Could not load the quiz. Please tell your teacher.")
      )
      .finally(() => setLoading(false));
  }, []);

  // Total mode: count the whole quiz down
  useEffect(() => {
    if (!quizStarted || submitted || mode !== "total") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, submitted, mode]);

  // Per-question mode: count the current question down (restarts on each question)
  useEffect(() => {
    if (!quizStarted || submitted || mode !== "perQuestion") return;

    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, submitted, mode, currentIndex]);

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

  // Per-question mode: go to the next question, or submit after the last one
  const goToNext = () => {
    if (currentIndex >= questions.length - 1) {
      submitQuiz();
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setQuestionTimeLeft(questions[next].timeSeconds || 30);
  };

  // Always point at the newest functions, so a timer sees the latest answers
  const actionsRef = useRef({});
  actionsRef.current = { submitQuiz, goToNext };

  // When a countdown reaches zero, move on automatically
  useEffect(() => {
    if (!quizStarted || submitted) return;

    if (mode === "total" && timeLeft === 0) {
      setTimedOut(true);
      actionsRef.current.submitQuiz();
    }

    if (mode === "perQuestion" && questionTimeLeft === 0) {
      if (currentIndex >= questions.length - 1) setTimedOut(true);
      actionsRef.current.goToNext();
    }
  }, [
    quizStarted,
    submitted,
    mode,
    timeLeft,
    questionTimeLeft,
    currentIndex,
    questions.length,
  ]);

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

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;

  const activeTime = mode === "perQuestion" ? questionTimeLeft : timeLeft;
  const timeLow =
    quizStarted && activeTime <= (mode === "perQuestion" ? 10 : 30);
  const answeredCount = Object.keys(answers).length;

  let timerText = `Time Remaining: ${formatTime(timeLeft)}`;
  if (mode === "perQuestion") {
    timerText = quizStarted
      ? `Time for this question: ${formatTime(questionTimeLeft)}`
      : "Each question has its own time limit";
  }

  return (
    <div className="exam-page">
      <header className="exam-bar">
        <div className="exam-brand">
          <span className="exam-seal" aria-hidden="true" />
          Let's Do ThisS
        </div>
        <div className={`timer ${timeLow ? "low" : ""}`} role="timer">
          {timerText}
        </div>
      </header>

      <div className="quiz-container">
      <h1 className="quiz-title">
        {quizStarted ? "Answer sheet" : "Before you begin"}
      </h1>

      {!quizStarted && (
        <ol className="exam-instructions">
          <li>Type your full name exactly as it should appear on your result.</li>
          <li>
            {mode === "perQuestion"
              ? "Each question is timed. When time ends, the next question opens and you cannot go back."
              : "The timer starts when you press Start Quiz. Your answers are submitted automatically when time ends."}
          </li>
          <li>Choose one answer for each question. Do not refresh or leave this page.</li>
        </ol>
      )}

      <label className="field-label" htmlFor="candidate-name">
        Full name
      </label>
      <input
        id="candidate-name"
        className={`name-input ${nameError ? "input-error" : ""}`}
        type="text"
        placeholder="Type your full name"
        value={name}
        disabled={quizStarted}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError("");
        }}
      />
      {nameError && <p className="error-text">{nameError}</p>}
      {loadError && <p className="error-text">{loadError}</p>}
      {!loading && !loadError && questions.length === 0 && (
        <p className="error-text">
          No questions have been added yet. Please check back soon.
        </p>
      )}

      <button
        className="btn-primary"
        disabled={
          loading || questions.length === 0 || loadError !== "" || quizStarted
        }
        onClick={() => {
          if (name.trim() === "") {
            setNameError("Please enter your name to start the quiz");
            return;
          }
          setNameError("");
          setCurrentIndex(0);
          setQuestionTimeLeft(questions[0].timeSeconds || 30);
          setQuizStarted(true);
        }}
      >
        Start Quiz
      </button>

      {/* Total time: every question on one page */}
      {quizStarted && mode === "total" && (
        <>
          <div className="answered-bar">
            <span>
              {answeredCount} of {questions.length} answered
            </span>
            <div className="answered-track">
              <div
                className="answered-fill"
                style={{
                  width: `${
                    questions.length
                      ? (answeredCount / questions.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
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
                    checked={answers[q.id] === option}
                    disabled={submitting || timeLeft === 0}
                    onChange={() => handleAnswer(q.id, option)}
                  />
                  <span className="option-letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="option-text">{option}</span>
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

      {/* Time per question: one question at a time, no going back */}
      {quizStarted && mode === "perQuestion" && currentQuestion && (
        <>
          <p className="question-progress">
            Question {currentIndex + 1} of {questions.length}
          </p>

          <div className="question" key={currentQuestion.id}>
            <h3>{currentQuestion.question}</h3>

            {currentQuestion.options.map((option, i) => (
              <label key={i} className="option">
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={answers[currentQuestion.id] === option}
                  disabled={submitting || questionTimeLeft === 0}
                  onChange={() => handleAnswer(currentQuestion.id, option)}
                />
                <span className="option-letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="option-text">{option}</span>
                </label>
            ))}
          </div>

          {submitError && <p className="error-text">{submitError}</p>}

          <button
            className="btn-primary"
            onClick={goToNext}
            disabled={submitting}
          >
            {isLastQuestion
              ? submitting
                ? "Submitting..."
                : "Submit Quiz"
              : "Next question"}
          </button>
          <p className="review-line">
            You cannot go back to earlier questions.
          </p>
        </>
      )}
      </div>
    </div>
  );
}

export default App;