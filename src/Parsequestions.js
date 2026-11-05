// Turns plain text into questions. One block per question, blocks separated by a line of ---
//
//   Category: Percentages
//   Q: What is 15% of 200?
//   A) 20
//   B) 30
//   C) 40
//   D) 25
//   Answer: B
//   Time: 60            (optional, in seconds)
//   Solution:
//   Step 1: Write 15% as $\frac{15}{100}$.
//   ...                 (the solution is everything after "Solution:" up to the next ---)
//
// "Solution:" must come last in its block. A question may run over several lines.

const FIELD = /^(category|question|q|time|answer|solution|explanation)\s*:\s*(.*)$/i;
const OPTION = /^([A-D])[).]\s*(.*)$/i;

export function parseQuestions(raw) {
  const blocks = String(raw)
    .replace(/\r\n/g, "\n")
    .split(/^\s*-{3,}\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, blockIndex) => {
    const draft = {
      category: "",
      question: "",
      options: ["", "", "", ""],
      answer: "",
      time: "",
      solution: "",
    };

    let field = null;
    let optionIndex = -1;

    for (const line of block.split("\n")) {
      // everything after "Solution:" belongs to the solution
      if (field === "solution") {
        draft.solution += `\n${line}`;
        continue;
      }

      const named = line.trim().match(FIELD);
      const option = line.trim().match(OPTION);

      if (named) {
        const key = named[1].toLowerCase();
        const value = named[2].trim();

        if (key === "category") {
          draft.category = value;
          field = "category";
        } else if (key === "q" || key === "question") {
          draft.question = value;
          field = "question";
        } else if (key === "time") {
          draft.time = value;
          field = "time";
        } else if (key === "answer") {
          draft.answer = value;
          field = "answer";
        } else {
          draft.solution = value;
          field = "solution";
        }
      } else if (option && (field === "question" || field === "option")) {
        optionIndex = option[1].toUpperCase().charCodeAt(0) - 65;
        draft.options[optionIndex] = option[2].trim();
        field = "option";
      } else if (field === "question") {
        draft.question += `\n${line}`;
      } else if (field === "option" && optionIndex >= 0 && line.trim()) {
        draft.options[optionIndex] += ` ${line.trim()}`;
      }
    }

    const question = draft.question.trim();
    const label = `Question ${blockIndex + 1}${
      question ? ` (${question.replace(/\s+/g, " ").slice(0, 40)}...)` : ""
    }`;

    if (!question) {
      errors.push(`${label}: there is no "Q:" line.`);
      return;
    }

    const options = draft.options.map((o) => o.trim());
    if (options.some((o) => !o)) {
      errors.push(`${label}: it needs four options, written A) B) C) D).`);
      return;
    }

    let answer = draft.answer.trim();
    if (/^[A-D]$/i.test(answer)) {
      answer = options[answer.toUpperCase().charCodeAt(0) - 65];
    } else {
      const match = options.find((o) => o.toLowerCase() === answer.toLowerCase());
      answer = match || "";
    }
    if (!answer) {
      errors.push(`${label}: "Answer:" must be A, B, C or D.`);
      return;
    }

    let timeSeconds;
    if (draft.time.trim()) {
      timeSeconds = Number(draft.time);
      if (!Number.isInteger(timeSeconds) || timeSeconds < 5 || timeSeconds > 3600) {
        errors.push(`${label}: "Time:" must be a whole number of seconds from 5 to 3600.`);
        return;
      }
    }

    const solution = draft.solution.trim();
    if (solution.length > 8000) {
      errors.push(`${label}: the solution is longer than 8000 characters.`);
      return;
    }

    questions.push({
      category: draft.category.trim(),
      question,
      options,
      answer,
      ...(timeSeconds ? { timeSeconds } : {}),
      ...(solution ? { explanation: solution } : {}),
    });
  });

  return { questions, errors };
}

export const EXAMPLE = `Category: Percentages
Q: What is 15% of 200?
A) 20
B) 30
C) 40
D) 25
Answer: B
Solution:
Step 1: Write the percentage as a fraction. $15\\% = \\frac{15}{100}$.

Step 2: Multiply by the number. $\\frac{15}{100} \\times 200 = 30$.

Shortcut: 10% of 200 is 20 and 5% is 10, so 15% is $20 + 10 = 30$.
---
Category: Time and Work
Q: A can finish a job in 10 days and B in 15 days. Working together, how many days do they need?
A) 5
B) 6
C) 7.5
D) 12
Answer: B
Time: 90
Solution:
Step 1: A does $\\frac{1}{10}$ of the job a day and B does $\\frac{1}{15}$.

Step 2: Together they do $\\frac{1}{10} + \\frac{1}{15} = \\frac{3}{30} + \\frac{2}{30} = \\frac{5}{30} = \\frac{1}{6}$ a day.

So the job takes **6 days**.`;