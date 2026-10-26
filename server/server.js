const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

// ---------- Settings ----------
// Change this password. You can also set it without editing the code:
//   PowerShell:  $env:TEACHER_PASSWORD="your-new-password"; node server.js
if (process.env.NODE_ENV === "production" && !process.env.TEACHER_PASSWORD) {
  throw new Error("TEACHER_PASSWORD must be set in production.");
}

const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "admin123";
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000; // teacher stays signed in for 8 hours
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const RESULTS_FILE = path.join(__dirname, "results.json");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");
const BUILD_DIR = path.join(__dirname, "..", "build");

// ---------- Helpers ----------
const readJson = (file, fallback) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
};

const writeJson = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const sameText = (a, b) => {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

// Quote CSV cells, and stop spreadsheet apps from running a name like "=cmd..."
const csvCell = (value) => {
  let text = String(value === undefined || value === null ? "" : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};

// ---------- Teacher sessions ----------
const sessions = new Map(); // token -> expiry time
const attempts = new Map(); // ip -> { count, resetAt }

const requireTeacher = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expires = sessions.get(token);

  if (!expires || expires < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: "Not authorised" });
  }

  next();
};

app.post("/teacher/login", (req, res) => {
  const now = Date.now();
  const ip = req.ip;
  const entry = attempts.get(ip);

  if (entry && entry.resetAt > now && entry.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts" });
  }

  const supplied = String((req.body && req.body.password) || "");

  if (!sameText(supplied, TEACHER_PASSWORD)) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
    current.count += 1;
    attempts.set(ip, current);
    return res.status(401).json({ error: "Wrong password" });
  }

  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, now + TOKEN_LIFETIME_MS);
  res.json({ token });
});

app.post("/teacher/logout", requireTeacher, (req, res) => {
  sessions.delete(req.headers.authorization.slice(7));
  res.json({ success: true });
});

// ---------- Student routes (public) ----------
app.post("/submit", (req, res) => {
  const { name, score } = req.body || {};

  if (typeof name !== "string" || !name.trim() || name.length > 100) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ error: "Invalid score" });
  }

  const data = readJson(RESULTS_FILE, []);

  data.push({
    name: name.trim(),
    score,
    submittedAt: new Date().toISOString(), // stamped by the server
  });

  writeJson(RESULTS_FILE, data);
  res.json({ success: true });
});

app.get("/questions", (req, res) => {
  res.json(readJson(QUESTIONS_FILE, []));
});

// ---------- Teacher routes (login required) ----------
app.get("/results", requireTeacher, (req, res) => {
  res.json(readJson(RESULTS_FILE, []));
});

app.get("/export-results", requireTeacher, (req, res) => {
  const results = readJson(RESULTS_FILE, []);

  let csv = "Name,Score,Submission Date\n";
  results.forEach((student) => {
    csv += [
      csvCell(student.name),
      csvCell(student.score),
      csvCell(student.submittedAt || ""),
    ].join(",") + "\n";
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=results.csv");
  res.send(csv);
});

app.delete("/clear-results", requireTeacher, (req, res) => {
  writeJson(RESULTS_FILE, []);
  res.json({ success: true });
});

app.post("/add-question", requireTeacher, (req, res) => {
  const { category, question, options, answer } = req.body || {};

  const validOptions =
    Array.isArray(options) &&
    options.length === 4 &&
    options.every((o) => typeof o === "string" && o.trim());

  if (typeof question !== "string" || !question.trim() || !validOptions) {
    return res.status(400).json({ error: "Invalid question" });
  }
  const cleanOptions = options.map((o) => o.trim());
  const cleanAnswer = String(answer || "").trim();

  if (!cleanOptions.includes(cleanAnswer)) {
    return res.status(400).json({ error: "Answer must be one of the options" });
  }

  const questions = readJson(QUESTIONS_FILE, []);
  const nextId = questions.reduce((max, q) => Math.max(max, q.id || 0), 0) + 1;

  questions.push({
    id: nextId,
    category: typeof category === "string" ? category.trim() : "",
    question: question.trim(),
    options: cleanOptions,
    answer: cleanAnswer,
  });

  writeJson(QUESTIONS_FILE, questions);
  res.json({ success: true });
});

app.get("/teacher/questions", requireTeacher, (req, res) => {
  res.json(readJson(QUESTIONS_FILE, []));
});

app.delete("/questions/:id", requireTeacher, (req, res) => {
  const id = Number(req.params.id);
  const questions = readJson(QUESTIONS_FILE, []);
  const remaining = questions.filter((q) => q.id !== id);

  if (remaining.length === questions.length) {
    return res.status(404).json({ error: "Question not found" });
  }

  writeJson(QUESTIONS_FILE, remaining);
  res.json({ success: true });
});

app.use(express.static(BUILD_DIR));
app.use((req, res, next) => {
  if (
    !fs.existsSync(path.join(BUILD_DIR, "index.html")) ||
    req.method !== "GET" ||
    !req.accepts("html")
  ) {
    return next();
  }

  res.sendFile(path.join(BUILD_DIR, "index.html"), (error) => {
    if (error) next(error);
  });
});

// The first time the server runs, start with your existing three questions
const STARTER_QUESTIONS = [
  {
    id: 1,
    category: "Mathematics",
    question: "10+10 = ?",
    options: ["20", "30", "40", "50"],
    answer: "20",
  },
  {
    id: 2,
    category: "Mathematics",
    question: "What is the square root of 16?",
    options: ["4", "8", "16", "32"],
    answer: "4",
  },
  {
    id: 3,
    category: "Mathematics",
    question: "square of 5 = ?",
    options: ["30", "25", "35", "40"],
    answer: "25",
  },
];

if (!fs.existsSync(QUESTIONS_FILE)) {
  writeJson(QUESTIONS_FILE, STARTER_QUESTIONS);
}

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});