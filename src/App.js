import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";


function App() {
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [nameError, setNameError] = useState("");

  const [questions, setQuestions] = useState([]);
const [loadError, setLoadError] = useState("");

useEffect(() => {
  axios
    .get("/questions")
    .then((response) => setQuestions(response.data))
    .catch(() =>
      setLoadError("Could not load the questions. Please tell your teacher.")
    );
}, []);

  const [quizStarted, setQuizStarted] =
  useState(false);


  const [timeLeft, setTimeLeft] = useState(180);
  useEffect(() => {
  if (!quizStarted || submitted) return;

  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);

        submitQuiz();

        return 0;
      }

      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [quizStarted, submitted]);


  const handleAnswer = (questionIndex, option) => {
    setAnswers({
      ...answers,
      [questionIndex]: option,
    });
  };

  const submitQuiz = async () => {
    if (timeLeft === 0) {
  alert(
    "Time is up! Quiz submitted automatically."
  );
}
    if (name.trim() === "") {
      alert("Please enter your name.");
}

    let totalScore = 0;

    questions.forEach((q, index) => {
      if (answers[index] === q.answer) {
        totalScore++;
      }
    });

    setScore(totalScore);
    setSubmitted(true);

    try {
      await axios.post("/submit", {
        name,
        score: totalScore,
        answersedAt: new Date(),
      });
    } catch (error) {
      console.error(error);
    }
  };
  if (submitted) {
  const total = questions.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const message =
    percent >= 80 ? "Excellent work!" : percent >= 50 ? "Good effort!" : "Keep practicing!";

  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-header">
          <span className="result-badge">Quiz Submitted</span>
          <h1>{message}</h1>
          <p className="result-name">{name}</p>
        </div>

        <div className="score-circle" style={{ "--pct": `${percent}%` }}>
          <div className="score-inner">
            <span className="score-number">{score}/{total}</span>
            <span className="score-percent">{percent}%</span>
          </div>
        </div>

        <h2 className="review-title">Review Answers</h2>

        {questions.map((q, index) => {
          const yourAnswer = answers[index];
          const correctAnswer = q.answer;
          const isCorrect = yourAnswer === correctAnswer;

          return (
            <div key={index} className={`review-item ${isCorrect ? "correct" : "wrong"}`}>
              <div className="review-top">
                <span className="review-q">Question {index + 1}</span>
                <span className="review-status">{isCorrect ? "Correct" : "Incorrect"}</span>
              </div>
              <p className="review-text">{q.question}</p>
              <p className="review-line">
                Your answer: <strong>{yourAnswer || "Not answered"}</strong>
              </p>
              {!isCorrect && (
                <p className="review-line">
                  Correct answer: <strong>{correctAnswer}</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

  return (
    <div className="quiz-container">
      <h2 className="timer">
  Time Remaining:{" "}
  {Math.floor(timeLeft / 60)}
  :
  {(timeLeft % 60)
    .toString()
    .padStart(2, "0")}
</h2>
      <h1 className="quiz-title">Let's do this</h1>

      <input
  className={`name-input ${nameError ? "input-error" : ""}`}
  type="text"
  placeholder="Enter Your Name"
  value={name}
  onChange={(e) => {
    setName(e.target.value);
    if (nameError) setNameError("");
  }}
/>
{nameError && <p className="error-text">{nameError}</p>}
{loadError && <p className="error-text">{loadError}</p>}

<button
  className="btn-primary" disabled={questions.length === 0 || loadError !== ""}
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
      <div className="question" key={index}>
        <h3>
          {index + 1}. {q.question}
        </h3>

        {q.options.map((option, i) => (
  <label key={i} className="option">
    <input
      type="radio"
      name={`question-${index}`}
      value={option}
      onChange={() => handleAnswer(index, option)}
    />
    {option}
  </label>
))}
  </div>
    ))}
  </>
)}

      {quizStarted && (
  <button className="btn-primary" onClick={submitQuiz} disabled={submitted}>
    {submitted ? "Quiz Submitted" : "Submit Quiz"}
  </button>
)}

      
    </div>
  );
}

export default App;