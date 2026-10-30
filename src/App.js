import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";
import MathText from "./MathText";
import CountUp from "./CountUp";
import QuestionNavigator from "./Questionnavigator.js";
import { AnimatePresence, m } from "motion/react";

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
  const [totalSeconds, setTotalSeconds] = useState(180);
  const [currentIndex, setCurrentIndex] = useState(0); // per-question mode
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0); // per-question mode

  // answers are saved by question id: { 1: "20", 2: "4" }
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({}); // questions flagged "mark for review"
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

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
        setTotalSeconds(settingsResponse.data.totalSeconds);
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

  const toggleMark = (questionId) => {
    setMarked((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Scroll to a question and put the cursor on its first option
  const jumpToQuestion = (questionId) => {
    const el = document.getElementById(`question-${questionId}`);
    if (!el) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });

    const firstOption = el.querySelector("input");
    if (firstOption) firstOption.focus({ preventScroll: true });
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

          <div className="score-mark">
            <svg className="score-pen" viewBox="0 0 200 140" aria-hidden="true">
              <m.path
                d="M100 8 C 150 6 192 34 190 72 C 188 112 146 134 98 132 C 52 130 10 108 12 66 C 14 30 54 10 108 10 C 128 10 150 18 160 26"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.25, ease: "easeOut" }}
              />
            </svg>
            <div className="score-text">
              <span className="score-number">
                <CountUp to={score} delay={0.4} />/{total}
              </span>
              <span className="score-percent">
                <CountUp to={percent} delay={0.4} />%
              </span>
            </div>
          </div>

          <h2 className="review-title">Review Answers</h2>

          {review.map((item, index) => (
            <m.div
              key={item.id}
              className={`review-item ${item.correct ? "correct" : "wrong"}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 1.3 + Math.min(index, 8) * 0.07 }}
            >
              <div className="review-top">
                <span className="review-q">Question {index + 1}</span>
                <span className="review-status">
                  {item.correct ? "Correct" : "Incorrect"}
                </span>
              </div>
              <p className="review-text">
                <MathText text={item.question} />
              </p>
              <p className="review-line">
                Your answer:{" "}
                <strong>
                  {item.yourAnswer ? (
                    <MathText text={item.yourAnswer} />
                  ) : (
                    "Not answered"
                  )}
                </strong>
              </p>
              {!item.correct && item.correctAnswer && (
                <p className="review-line">
                  Correct answer:{" "}
                  <strong>
                    <MathText text={item.correctAnswer} />
                  </strong>
                </p>
              )}
            </m.div>
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
  const unansweredCount = questions.length - answeredCount;
  const markedCount = questions.filter((q) => marked[q.id]).length;

  // Ask before submitting if something is unanswered or marked for review
  const handleSubmitClick = () => {
    if ((unansweredCount > 0 || markedCount > 0) && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    submitQuiz();
  };
  const timeLimit =
    mode === "perQuestion"
      ? (currentQuestion && currentQuestion.timeSeconds) || 30
      : totalSeconds;
  const timeFraction =
    quizStarted && timeLimit
      ? Math.max(0, Math.min(1, activeTime / timeLimit))
      : 1;

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
          Online examination
        </div>
        <div className={`timer ${timeLow ? "low" : ""}`} role="timer">
          {timerText}
        </div>
        <div className="time-line" aria-hidden="true">
          <div
            className={`time-line-fill ${timeLow ? "low" : ""}`}
            style={{ transform: `scaleX(${timeFraction})` }}
          />
        </div>
      </header>

      <div className="quiz-container">
      <h1 className="quiz-title">
        {quizStarted ? "Answer sheet" : "Before you begin"}
      </h1>

      <AnimatePresence initial={false}>
      {!quizStarted && (
        <m.ol
          key="instructions"
          className="exam-instructions"
          style={{ overflow: "hidden" }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.25 }}
        >
          <li>Type your full name exactly as it should appear on your result.</li>
          <li>
            {mode === "perQuestion"
              ? "Each question is timed. When time ends, the next question opens and you cannot go back."
              : "The timer starts when you press Start Quiz. Your answers are submitted automatically when time ends."}
          </li>
          <li>Choose one answer for each question. Do not refresh or leave this page.</li>
        </m.ol>
      )}
      </AnimatePresence>

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

      {quizStarted && (
        <QuestionNavigator
          questions={questions}
          answers={answers}
          marked={marked}
          mode={mode}
          currentIndex={currentIndex}
          onJump={jumpToQuestion}
        />
      )}

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
            <m.div
              id={`question-${q.id}`}
              className="question"
              key={q.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.06 }}
            >
              <div className="question-head">
                <h3>
                  {index + 1}. <MathText text={q.question} />
                </h3>
                <button
                  type="button"
                  className={`mark-btn ${marked[q.id] ? "on" : ""}`}
                  aria-pressed={Boolean(marked[q.id])}
                  disabled={submitting || timeLeft === 0}
                  onClick={() => toggleMark(q.id)}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M3 1.5v13M3 2.5h9l-2 3.5 2 3.5H3" />
                  </svg>
                  {marked[q.id] ? "Marked for review" : "Mark for review"}
                </button>
              </div>

              {q.options.map((option, i) => (
                <m.label
                  key={i}
                  className="option"
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <input
                    type="radio"
                    name={`question-${q.id}`}
                    value={option}
                    checked={answers[q.id] === option}
                    disabled={submitting || timeLeft === 0}
                    onChange={() => handleAnswer(q.id, option)}
                  />
                  <m.span
                    className="option-letter"
                    aria-hidden="true"
                    animate={{ scale: (answers[q.id] === option) ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {String.fromCharCode(65 + i)}
                  </m.span>
                  <span className="option-text">
                    <MathText text={option} />
                  </span>
                </m.label>
              ))}
            </m.div>
          ))}

          {submitError && <p className="error-text">{submitError}</p>}

          <AnimatePresence initial={false}>
            {confirmingSubmit && (
              <m.div
                key="confirm"
                className="submit-confirm"
                role="group"
                aria-label="Before you submit"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
              >
                <p className="submit-confirm-title">Before you submit</p>
                <ul>
                  {unansweredCount > 0 && (
                    <li>
                      {unansweredCount} question
                      {unansweredCount > 1 ? "s are" : " is"} not answered
                    </li>
                  )}
                  {markedCount > 0 && (
                    <li>
                      {markedCount} question{markedCount > 1 ? "s are" : " is"}{" "}
                      marked for review
                    </li>
                  )}
                  {unansweredCount === 0 && markedCount === 0 && (
                    <li>Everything is answered.</li>
                  )}
                </ul>
                <div className="submit-confirm-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setConfirmingSubmit(false)}
                  >
                    Keep reviewing
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={submitQuiz}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit now"}
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {!confirmingSubmit && (
          <button
            className="btn-primary"
            onClick={handleSubmitClick}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
          )}
        </>
      )}

      {/* Time per question: one question at a time, no going back */}
      {quizStarted && mode === "perQuestion" && currentQuestion && (
        <>
          <p className="question-progress">
            Question {currentIndex + 1} of {questions.length}
          </p>

          <AnimatePresence mode="wait" initial={false}>
          <m.div
            className="question"
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.22 }}
          >
            <h3>
              <MathText text={currentQuestion.question} />
            </h3>

            {currentQuestion.options.map((option, i) => (
              <m.label
                  key={i}
                  className="option"
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={answers[currentQuestion.id] === option}
                  disabled={submitting || questionTimeLeft === 0}
                  onChange={() => handleAnswer(currentQuestion.id, option)}
                />
                <m.span
                    className="option-letter"
                    aria-hidden="true"
                    animate={{ scale: (answers[currentQuestion.id] === option) ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {String.fromCharCode(65 + i)}
                  </m.span>
                  <span className="option-text">
                    <MathText text={option} />
                  </span>
                </m.label>
            ))}
          </m.div>
          </AnimatePresence>

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