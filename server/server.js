const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

// ---------- Settings (set these as environment variables, never in the code) ----------
const MONGODB_URI = process.env.MONGODB_URI;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "admin123";
const PORT = process.env.PORT || 5000;

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
app.post(
  "/submit",
  route(async (req, res) => {
    const { name, score } = req.body || {};

    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "Invalid score" });
    }

    await resultsCol().insertOne({
      name: name.trim(),
      score,
      submittedAt: new Date().toISOString(), // stamped by the server
    });

    res.json({ success: true });
  })
);

app.get(
  "/questions",
  route(async (req, res) => {
    const questions = await questionsCol().find({}, hidden).sort({ id: 1 }).toArray();
    res.json(questions);
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

app.post(
  "/add-question",
  requireTeacher,
  route(async (req, res) => {
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

    const last = await questionsCol().find({}).sort({ id: -1 }).limit(1).toArray();
    const nextId = last.length > 0 ? last[0].id + 1 : 1;

    await questionsCol().insertOne({
      id: nextId,
      category: typeof category === "string" ? category.trim() : "",
      question: question.trim(),
      options: cleanOptions,
      answer: cleanAnswer,
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