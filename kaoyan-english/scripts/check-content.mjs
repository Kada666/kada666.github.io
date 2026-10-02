import { readFileSync } from "node:fs";

const base = new URL("../", import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, base), "utf8"));
const packs = read("data/packs.json");
const senses = read("data/senses.json");
const freq = read("data/freq.json");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;

check(Array.isArray(packs) && packs.length > 0, "packs.json 必须有日期数组");
check(record(senses), "senses.json 必须是词义对象");
check(record(freq) && freq.papers === 15 && record(freq.df), "freq.json 应包含 15 套试卷的 df");

const dates = new Set();
const passages = new Set();
const paragraphs = new Set();
let lastDate = "";
for (const pack of Array.isArray(packs) ? packs : []) {
  check(text(pack.date) && /^\d{4}-\d{2}-\d{2}$/.test(pack.date), "日期格式应为 YYYY-MM-DD");
  check(!dates.has(pack.date), `重复日期：${pack.date}`);
  check(pack.date > lastDate, `日期需要按顺序追加：${pack.date}`);
  dates.add(pack.date);
  lastDate = pack.date;
  check(Array.isArray(pack.passages) && pack.passages.length >= 1 && pack.passages.length <= 2, `${pack.date} 应有 1–2 篇`);
  let minutes = 0;
  for (const passage of Array.isArray(pack.passages) ? pack.passages : []) {
    const source = `${pack.date}:${passage.id}`;
    check(text(passage.id) && !passages.has(source), `文章 ID 缺失或重复：${source}`);
    passages.add(source);
    check(text(passage.title), `${source} 缺少标题`);
    check(Number.isInteger(passage.minutes) && passage.minutes > 0, `${source} 阅读分钟数无效`);
    minutes += passage.minutes || 0;
    check(Array.isArray(passage.paragraphs) && passage.paragraphs.length >= 2, `${source} 至少需要两段正文`);
    for (const paragraph of Array.isArray(passage.paragraphs) ? passage.paragraphs : []) {
      check(text(paragraph) && paragraph.trim().length >= 60, `${source} 有过短或空白段落`);
      const normalized = String(paragraph).replace(/\s+/g, " ").trim().toLowerCase();
      check(!paragraphs.has(normalized), `${source} 有与旧文章重复的段落`);
      paragraphs.add(normalized);
    }
    check(Array.isArray(passage.quiz) && passage.quiz.length >= 1 && passage.quiz.length <= 2, `${source} 应有 1–2 题`);
    for (const [index, quiz] of (Array.isArray(passage.quiz) ? passage.quiz : []).entries()) {
      const question = `${source} 第 ${index + 1} 题`;
      check(text(quiz.q), `${question} 缺少题干`);
      check(Array.isArray(quiz.options) && quiz.options.length === 4 && quiz.options.every(text), `${question} 应有四个非空选项`);
      check(Number.isInteger(quiz.a) && quiz.a >= 0 && quiz.a < 4, `${question} 答案下标应为 0–3`);
      check(text(quiz.why), `${question} 缺少一句依据`);
      if (Array.isArray(quiz.options)) {
        check(new Set(quiz.options.map(option => String(option).trim().toLowerCase())).size === 4, `${question} 有重复选项`);
      }
    }
  }
  check(minutes >= 7 && minutes <= 10, `${pack.date} 总时长应为 7–10 分钟`);
}

if (record(senses)) {
  for (const [word, sense] of Object.entries(senses)) {
    check(record(sense) && text(sense.common), `${word} 缺少常见义`);
    check(!sense?.extended || text(sense.extended), `${word} 的熟词生义为空`);
  }
}
if (record(freq?.df)) {
  check(Object.values(freq.df).every(count => Number.isInteger(count) && count >= 0 && count <= freq.papers), "freq.json 有无效出现套数");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`内容检查通过：${dates.size} 天，${passages.size} 篇，${Object.keys(senses).length} 个释义。`);
}
