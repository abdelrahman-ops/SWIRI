/**
 * Swiri – Synthetic RiskAssessment Seed Script
 * =============================================
 * Generates 3 000 risk-assessment documents (1 000 per class) that match
 * the RiskAssessment Mongoose schema exactly, then bulk-inserts them into
 * the connected MongoDB database.
 *
 * Usage:
 *   node seed-risk-data.mjs              # uses MONGO_URI from .env
 *   MONGO_URI=mongodb://... node seed-risk-data.mjs
 *
 * The script will:
 *  1. Pick (or create) a test child document to attach records to.
 *  2. For each synthetic row generate realistic raw arrays
 *     (heart_rate_raw, accelerometer_raw) that produce the desired
 *     calculated features (HR_Mean, HR_Gradient, Acc_Mean, Acc_Variance).
 *  3. Build aiResponse with prediction_code, confidence_percentage,
 *     status_label, and calculated_features.
 *  4. Bulk-insert into the RiskAssessment collection.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "./src/config/db.js";
import RiskAssessment from "./src/models/RiskAssessment.js";
import Child from "./src/models/Child.js";

// ── Config ────────────────────────────────────────────────────────────
const NUM_SAMPLES_PER_CLASS = 1000;
const LABELS = {
  0: "normal",
  1: "playing",
  2: "danger",
};

// ── Deterministic pseudo-random (seedable) ────────────────────────────
// Mulberry32 PRNG – small, fast, seedable
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

/** Normal distribution via Box-Muller */
function normal(mean, std) {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/** Clamp value */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Round to n decimals */
const round = (v, n = 2) => +v.toFixed(n);

// ── Synthetic-row generators (mirrors the Python script) ──────────────

function genNormal() {
  return {
    hr_mean: round(clamp(normal(87, 8), 60, 200), 1),
    hr_gradient: round(normal(0, 1.5), 2),
    acc_mean: round(normal(1.1, 0.05), 3),
    acc_variance: round(clamp(normal(0.05, 0.02), 0, 10), 3),
    label: 0,
  };
}

function genPlaying() {
  return {
    hr_mean: round(clamp(normal(128, 15), 60, 220), 1),
    hr_gradient: round(normal(8, 5), 2),
    acc_mean: round(normal(2.2, 0.5), 3),
    acc_variance: round(clamp(normal(0.4, 0.2), 0, 10), 3),
    label: 1,
  };
}

function genDangerStruggle() {
  return {
    hr_mean: round(clamp(normal(140, 18), 60, 240), 1),
    hr_gradient: round(normal(22, 10), 2),
    acc_mean: round(normal(2.8, 0.8), 3),
    acc_variance: round(clamp(normal(1.2, 0.7), 0, 10), 3),
    label: 2,
  };
}

function genDangerFreeze() {
  return {
    hr_mean: round(clamp(normal(145, 10), 60, 240), 1),
    hr_gradient: round(normal(30, 5), 2),
    acc_mean: round(normal(1.0, 0.02), 3),
    acc_variance: round(clamp(normal(0.01, 0.005), 0, 10), 3),
    label: 2,
  };
}

// ── Build raw arrays that reproduce the calculated features ──────────

/**
 * Generate a plausible heart_rate_raw array whose mean ≈ hr_mean.
 * Length: 30 samples (~30 s of 1 Hz HR data).
 */
function buildHeartRateRaw(hrMean) {
  const len = 30;
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(round(clamp(normal(hrMean, 5), 40, 250), 0));
  }
  return arr;
}

/**
 * Generate a plausible accelerometer_raw array whose mean ≈ acc_mean
 * and variance ≈ acc_variance.  Length: 60 samples (~1 s at 60 Hz).
 */
function buildAccelerometerRaw(accMean, accVariance) {
  const len = 60;
  const std = Math.sqrt(Math.max(accVariance, 0.001));
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(round(clamp(normal(accMean, std), 0, 20), 3));
  }
  return arr;
}

// ── Confidence heuristic ─────────────────────────────────────────────
function confidence(label) {
  // Simulate confidence spread per class
  if (label === 0) return round(clamp(normal(92, 4), 55, 100), 1);
  if (label === 1) return round(clamp(normal(85, 7), 50, 100), 1);
  return round(clamp(normal(80, 10), 45, 100), 1);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🔌 Connecting to MongoDB …");
  await connectDb(process.env.MONGO_URI);

  // Find or create a test child to attach records to
  let child = await Child.findOne();
  if (!child) {
    child = await Child.create({ name: "Seed Test Child" });
    console.log(`👶 Created test child: ${child._id}`);
  } else {
    console.log(`👶 Using existing child: ${child.name} (${child._id})`);
  }

  console.log(`\n📊 Generating ${NUM_SAMPLES_PER_CLASS * 3} synthetic risk assessments …\n`);

  const docs = [];

  // Class 0 – Normal
  for (let i = 0; i < NUM_SAMPLES_PER_CLASS; i++) {
    const row = genNormal();
    docs.push(buildDoc(child._id, row));
  }

  // Class 1 – Playing
  for (let i = 0; i < NUM_SAMPLES_PER_CLASS; i++) {
    const row = genPlaying();
    docs.push(buildDoc(child._id, row));
  }

  // Class 2 – Danger (80 % struggle, 20 % freeze)
  const numStruggle = Math.floor(NUM_SAMPLES_PER_CLASS * 0.8);
  const numFreeze = NUM_SAMPLES_PER_CLASS - numStruggle;

  for (let i = 0; i < numStruggle; i++) {
    docs.push(buildDoc(child._id, genDangerStruggle()));
  }
  for (let i = 0; i < numFreeze; i++) {
    docs.push(buildDoc(child._id, genDangerFreeze()));
  }

  // Shuffle (Fisher-Yates)
  for (let i = docs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [docs[i], docs[j]] = [docs[j], docs[i]];
  }

  console.log(`✅ Generated ${docs.length} documents. Inserting …`);

  // Bulk insert in chunks to avoid memory spikes
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK);
    await RiskAssessment.insertMany(chunk, { ordered: false });
    inserted += chunk.length;
    process.stdout.write(`\r   inserted ${inserted} / ${docs.length}`);
  }
  console.log("");

  console.log(`\n🎉 Done! ${inserted} RiskAssessment records saved to database.\n`);

  // Quick stats
  const stats = await RiskAssessment.aggregate([
    { $match: { child: child._id } },
    {
      $group: {
        _id: "$aiResponse.prediction_code",
        count: { $sum: 1 },
        avgConfidence: { $avg: "$aiResponse.confidence_percentage" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  console.log("📈 DB Stats:");
  stats.forEach((s) => {
    console.log(`   Class ${s._id} (${LABELS[s._id]}): ${s.count} docs, avg confidence ${s.avgConfidence.toFixed(1)}%`);
  });

  await mongoose.disconnect();
}

function buildDoc(childId, row) {
  const heartRateRaw = buildHeartRateRaw(row.hr_mean);
  const accelerometerRaw = buildAccelerometerRaw(row.acc_mean, row.acc_variance);

  return {
    child: childId,
    source: "watch",
    rawPayload: {
      heart_rate_raw: heartRateRaw,
      accelerometer_raw: accelerometerRaw,
    },
    aiResponse: {
      prediction_code: row.label,
      confidence_percentage: confidence(row.label),
      status_label: LABELS[row.label],
      calculated_features: {
        hr_mean: row.hr_mean,
        hr_gradient: row.hr_gradient,
        acc_mean: row.acc_mean,
        acc_variance: row.acc_variance,
      },
    },
  };
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
