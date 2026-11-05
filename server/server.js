const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---------- Settings (set these as environment variables, never in the code) ----------
const MONGODB_URI = process.env.MONGODB_URI;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "admin123";
const PORT = process.env.PORT || 5000;
// Set SHOW_CORRECT_ANSWERS=false to hide the right answers on the result page
const SHOW_CORRECT_ANSWERS = process.env.SHOW_CORRECT_ANSWERS !== "false";

const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000; // teacher stays signed in for 8 hours
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Set it before starting the server.");
  process.exit(1);
}

if (TEACHER_PASSWORD === "admin123") {
  console.warn("WARNING: using the default teacher password. Set TEACHER_PASSWORD.");
}

// ---------- Database ----------
const client = new MongoClient(MONGODB_URI);
let db;

const resultsCol = () => db.collection("results");
const questionsCol = () => db.collection("questions");
const hidden = { projection: { _id: 0 } }; // do not send MongoDB's internal id

// ---------- Quiz timer settings ----------
// mode "total": one countdown for the whole quiz
// mode "perQuestion": each question has its own countdown
const DEFAULT_SETTINGS = {
  mode: "total",
  totalSeconds: 180,
  defaultQuestionSeconds: 30,
  solutionsOpen: false, // the Solutions page stays hidden until the teacher releases it
};

const validSeconds = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

const getSettings = async () => {
  const stored = await db.collection("settings").findOne({ _id: "timer" });
  const { _id, ...rest } = stored || {};
  return { ...DEFAULT_SETTINGS, ...rest };
};

// Catch errors in async routes so one bad request cannot crash the server
const route = (handler) => (req, res) =>
  handler(req, res).catch((error) => {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  });

// ---------- Helpers ----------
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
// Kept in memory: if the server restarts, teachers just sign in again.
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
    const current =
      entry && entry.resetAt > now
        ? entry
        : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
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
// Students receive the questions WITHOUT the correct answers.
app.get(
  "/questions",
  route(async (req, res) => {
    const settings = await getSettings();
    const questions = await questionsCol()
      .find({}, { projection: { _id: 0, answer: 0, explanation: 0 } })
      .sort({ id: 1 })
      .toArray();

    // A question without its own time uses the default time per question
    res.json(
      questions.map((q) => ({
        ...q,
        timeSeconds: q.timeSeconds || settings.defaultQuestionSeconds,
      }))
    );
  })
);

// How the quiz is timed (students need this to run the countdown)
app.get(
  "/quiz-settings",
  route(async (req, res) => {
    const settings = await getSettings();
    res.json({
      mode: settings.mode,
      totalSeconds: settings.totalSeconds,
      solutionsOpen: Boolean(settings.solutionsOpen),
    });
  })
);

// Every question with its answer and written solution, but only after the teacher releases it
app.get(
  "/solutions",
  route(async (req, res) => {
    const settings = await getSettings();
    if (!settings.solutionsOpen) {
      return res.status(403).json({ error: "Solutions are not released yet" });
    }

    const questions = await questionsCol().find({}, hidden).sort({ id: 1 }).toArray();
    res.json(questions);
  })
);

// The server marks the quiz. The student only sends the options they chose.
app.post(
  "/submit",
  route(async (req, res) => {
    const { name, answers } = req.body || {};

    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ error: "Invalid answers" });
    }

    const questions = await questionsCol().find({}, hidden).sort({ id: 1 }).toArray();

    if (questions.length === 0) {
      return res.status(400).json({ error: "No questions to mark" });
    }

    // Every current question is marked. A question left blank counts as wrong.
    const review = questions.map((q) => {
      const chosen = typeof answers[q.id] === "string" ? answers[q.id] : null;
      const item = {
        id: q.id,
        question: q.question,
        yourAnswer: chosen,
        correct: chosen === q.answer,
      };
      if (SHOW_CORRECT_ANSWERS) item.correctAnswer = q.answer;
      return item;
    });

    const score = review.filter((item) => item.correct).length;
    const total = questions.length;

    await resultsCol().insertOne({
      name: name.trim(),
      score,
      total,
      submittedAt: new Date().toISOString(), // stamped by the server
    });

    res.json({ score, total, review });
  })
);

// ---------- Teacher routes (login required) ----------
app.get(
  "/results",
  requireTeacher,
  route(async (req, res) => {
    const results = await resultsCol().find({}, hidden).sort({ submittedAt: 1 }).toArray();
    res.json(results);
  })
);

app.get(
  "/export-results",
  requireTeacher,
  route(async (req, res) => {
    const results = await resultsCol().find({}, hidden).sort({ submittedAt: 1 }).toArray();

    let csv = "Name,Score,Submission Date\n";
    results.forEach((student) => {
      csv +=
        [
          csvCell(student.name),
          csvCell(student.score),
          csvCell(student.submittedAt || ""),
        ].join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv);
  })
);

app.delete(
  "/clear-results",
  requireTeacher,
  route(async (req, res) => {
    await resultsCol().deleteMany({});
    res.json({ success: true });
  })
);

app.get(
  "/teacher/questions",
  requireTeacher,
  route(async (req, res) => {
    const questions = await questionsCol().find({}, hidden).sort({ id: 1 }).toArray();
    res.json(questions);
  })
);

app.get(
  "/teacher/settings",
  requireTeacher,
  route(async (req, res) => {
    res.json(await getSettings());
  })
);

app.put(
  "/teacher/settings",
  requireTeacher,
  route(async (req, res) => {
    const { mode, totalSeconds, defaultQuestionSeconds } = req.body || {};

    if (mode !== "total" && mode !== "perQuestion") {
      return res.status(400).json({ error: "Invalid mode" });
    }
    if (!validSeconds(totalSeconds, 10, 10800)) {
      return res.status(400).json({ error: "Total time must be 10 to 10800 seconds" });
    }
    if (!validSeconds(defaultQuestionSeconds, 5, 3600)) {
      return res.status(400).json({ error: "Question time must be 5 to 3600 seconds" });
    }

    await db
      .collection("settings")
      .updateOne(
        { _id: "timer" },
        { $set: { mode, totalSeconds, defaultQuestionSeconds } },
        { upsert: true }
      );

    res.json({ success: true });
  })
);

app.put(
  "/teacher/solutions-access",
  requireTeacher,
  route(async (req, res) => {
    const { open } = req.body || {};
    if (typeof open !== "boolean") {
      return res.status(400).json({ error: "open must be true or false" });
    }

    await db
      .collection("settings")
      .updateOne({ _id: "timer" }, { $set: { solutionsOpen: open } }, { upsert: true });

    res.json({ success: true });
  })
);

// Change a question's time and/or its written solution.
// Send timeSeconds: null or explanation: null to clear them.
app.patch(
  "/questions/:id",
  requireTeacher,
  route(async (req, res) => {
    const { timeSeconds, explanation } = req.body || {};
    const set = {};
    const unset = {};

    if (timeSeconds !== undefined) {
      if (timeSeconds === null) {
        unset.timeSeconds = "";
      } else if (validSeconds(timeSeconds, 5, 3600)) {
        set.timeSeconds = timeSeconds;
      } else {
        return res.status(400).json({ error: "Time must be 5 to 3600 seconds" });
      }
    }

    if (explanation !== undefined) {
      if (explanation === null || explanation === "") {
        unset.explanation = "";
      } else if (typeof explanation === "string" && explanation.length <= 8000) {
        set.explanation = explanation;
      } else {
        return res.status(400).json({ error: "Solution must be text of 8000 characters or less" });
      }
    }

    const update = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Nothing to change" });
    }

    const outcome = await questionsCol().updateOne({ id: Number(req.params.id) }, update);

    if (outcome.matchedCount === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ success: true });
  })
);

app.post(
  "/add-question",
  requireTeacher,
  route(async (req, res) => {
    const { category, question, options, answer, timeSeconds, explanation } = req.body || {};

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

    if (timeSeconds !== undefined && timeSeconds !== null && !validSeconds(timeSeconds, 5, 3600)) {
      return res.status(400).json({ error: "Time must be 5 to 3600 seconds" });
    }

    if (
      explanation !== undefined &&
      explanation !== null &&
      (typeof explanation !== "string" || explanation.length > 8000)
    ) {
      return res.status(400).json({ error: "Solution must be text of 8000 characters or less" });
    }

    const last = await questionsCol().find({}).sort({ id: -1 }).limit(1).toArray();
    const nextId = last.length > 0 ? last[0].id + 1 : 1;

    await questionsCol().insertOne({
      id: nextId,
      category: typeof category === "string" ? category.trim() : "",
      question: question.trim(),
      options: cleanOptions,
      answer: cleanAnswer,
      ...(timeSeconds ? { timeSeconds } : {}),
      ...(explanation && explanation.trim() ? { explanation: explanation.trim() } : {}),
    });

    res.json({ success: true });
  })
);

app.delete(
  "/questions/:id",
  requireTeacher,
  route(async (req, res) => {
    const outcome = await questionsCol().deleteOne({ id: Number(req.params.id) });

    if (outcome.deletedCount === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ success: true });
  })
);

// ---------- Bulk import (teacher) ----------
const cleanQuestion = (item) => {
  const { category, question, options, answer, timeSeconds, explanation } = item || {};

  if (typeof question !== "string" || !question.trim()) {
    return { error: "the question text is missing" };
  }
  if (
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every((o) => typeof o === "string" && o.trim())
  ) {
    return { error: "it needs four options" };
  }

  const cleanOptions = options.map((o) => o.trim());
  const cleanAnswer = String(answer || "").trim();
  if (!cleanOptions.includes(cleanAnswer)) {
    return { error: "the answer must match one of the options" };
  }
  if (timeSeconds !== undefined && timeSeconds !== null && !validSeconds(timeSeconds, 5, 3600)) {
    return { error: "the time must be 5 to 3600 seconds" };
  }
  if (
    explanation !== undefined &&
    explanation !== null &&
    (typeof explanation !== "string" || explanation.length > 8000)
  ) {
    return { error: "the solution is too long (8000 characters at most)" };
  }

  return {
    value: {
      category: typeof category === "string" ? category.trim() : "",
      question: question.trim(),
      options: cleanOptions,
      answer: cleanAnswer,
      ...(timeSeconds ? { timeSeconds } : {}),
      ...(explanation && explanation.trim() ? { explanation: explanation.trim() } : {}),
    },
  };
};

app.post(
  "/teacher/import-questions",
  requireTeacher,
  route(async (req, res) => {
    const { questions } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
      return res.status(400).json({ error: "Send between 1 and 200 questions" });
    }

    const cleaned = [];
    for (let i = 0; i < questions.length; i += 1) {
      const result = cleanQuestion(questions[i]);
      if (result.error) {
        return res.status(400).json({ error: `Question ${i + 1}: ${result.error}` });
      }
      cleaned.push(result.value);
    }

    // Nothing is saved unless every question is valid
    const last = await questionsCol().find({}).sort({ id: -1 }).limit(1).toArray();
    let nextId = last.length > 0 ? last[0].id + 1 : 1;
    const documents = cleaned.map((value) => ({ id: nextId++, ...value }));

    await questionsCol().insertMany(documents);
    res.json({ success: true, imported: documents.length });
  })
);

// ---------- Serve the website (the folder made by "npm run build") ----------
const BUILD_DIR = path.join(__dirname, "..", "build");
const INDEX_FILE = path.join(BUILD_DIR, "index.html");

if (fs.existsSync(INDEX_FILE)) {
  app.use(express.static(BUILD_DIR));
  // Any other page address (like /teacher) loads the React app
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(INDEX_FILE);
  });
}

// ---------- Start ----------
client
  .connect()
  .then(() => {
    db = client.db("quiz");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to the database:", error.message);
    process.exit(1);
  });