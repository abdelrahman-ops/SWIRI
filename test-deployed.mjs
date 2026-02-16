/**
 * Swiri Backend – Full Endpoint Integration Test
 * Target: https://swiri.vercel.app
 */

const BASE = "https://swiri.vercel.app";

// ── helpers ──────────────────────────────────────────────────────────
const http = async (method, path, body, token) => {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers, signal: AbortSignal.timeout(15000) };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json, ok: r.ok };
  } catch (e) {
    return { status: 0, json: { error: e.message }, ok: false };
  }
};

const results = [];
const log = (section, name, res) => {
  const icon = res.ok ? "✅" : "❌";
  const msg = typeof res.json === "object" ? (res.json.message || JSON.stringify(res.json).slice(0, 120)) : String(res.json).slice(0, 120);
  results.push({ section, name, status: res.status, ok: res.ok, msg });
  console.log(`${icon} [${res.status}] ${section} > ${name}  — ${msg}`);
};

// ── state ────────────────────────────────────────────────────────────
const UNIQUE = Date.now();
const TEST_EMAIL = `swiritest${UNIQUE}@test.com`;
const TEST_PHONE = `+20109${String(UNIQUE).slice(-7)}`;
let TOKEN = "";
let childId = "";
let schoolId = "";
let deviceId = "";
let sosId = "";
let geofenceId = "";
let alertId = "";

// ── tests ────────────────────────────────────────────────────────────
async function run() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  SWIRI DEPLOYED SERVER – FULL ENDPOINT TEST");
  console.log(`  Target : ${BASE}`);
  console.log(`  Time   : ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Health ────────────────────────────────────────────────────
  console.log("── 1. HEALTH ──────────────────────────────────────");
  let r = await http("GET", "/health");
  log("Health", "Health Check", r);

  // ── 2. Auth ──────────────────────────────────────────────────────
  console.log("\n── 2. AUTH ────────────────────────────────────────");

  // 2a. Sign Up
  r = await http("POST", "/api/auth/signup", {
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    password: "Test@12345678",
    confirmPassword: "Test@12345678",
    agreedToTerms: true,
    role: "parent",
  });
  log("Auth", "Sign Up", r);
  if (r.json?.data?.token) TOKEN = r.json.data.token;

  // 2b. Sign Up – duplicate (should 409)
  r = await http("POST", "/api/auth/signup", {
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    password: "Test@12345678",
    confirmPassword: "Test@12345678",
    agreedToTerms: true,
    role: "parent",
  });
  log("Auth", "Sign Up Duplicate (expect 409)", r);

  // 2c. Sign Up – password mismatch (expect 400)
  r = await http("POST", "/api/auth/signup", {
    email: `mismatch${UNIQUE}@test.com`,
    phone: `+20108${String(UNIQUE).slice(-7)}`,
    password: "Test@12345678",
    confirmPassword: "WrongPassword",
    agreedToTerms: true,
    role: "parent",
  });
  log("Auth", "Sign Up Password Mismatch (expect 400)", r);

  // 2d. Login
  r = await http("POST", "/api/auth/login", {
    identifier: TEST_EMAIL,
    password: "Test@12345678",
  });
  log("Auth", "Login (email)", r);
  if (r.json?.data?.token) TOKEN = r.json.data.token;

  // 2e. Login – wrong password (expect 401)
  r = await http("POST", "/api/auth/login", {
    identifier: TEST_EMAIL,
    password: "WrongPassword",
  });
  log("Auth", "Login Wrong Password (expect 401)", r);

  // 2f. Forgot Password
  r = await http("POST", "/api/auth/forgot-password", {
    identifier: TEST_EMAIL,
  });
  log("Auth", "Forgot Password", r);

  // ── 3. Users ─────────────────────────────────────────────────────
  console.log("\n── 3. USERS ───────────────────────────────────────");

  // 3a. Get Me (no token – expect 401)
  r = await http("GET", "/api/users/me");
  log("Users", "Get Me (no token, expect 401)", r);

  // 3b. Get Me
  r = await http("GET", "/api/users/me", null, TOKEN);
  log("Users", "Get Me", r);

  // 3c. Update Me
  r = await http("PATCH", "/api/users/me", { name: "Test Parent" }, TOKEN);
  log("Users", "Update Me", r);

  // ── 4. Children ──────────────────────────────────────────────────
  console.log("\n── 4. CHILDREN ────────────────────────────────────");

  // 4a. Create Child
  r = await http("POST", "/api/children", {
    name: "Test Child Adam",
    dateOfBirth: "2019-06-15",
  }, TOKEN);
  log("Children", "Create Child", r);
  if (r.json?.data?._id) childId = r.json.data._id;
  else if (r.json?.data?.child?._id) childId = r.json.data.child._id;

  // 4b. List Children
  r = await http("GET", "/api/children", null, TOKEN);
  log("Children", "List Children", r);
  // fallback to extract childId
  if (!childId && Array.isArray(r.json?.data) && r.json.data.length) {
    childId = r.json.data[0]._id;
  }

  console.log(`   → childId = ${childId || "NOT SET"}`);

  // ── 5. Schools ───────────────────────────────────────────────────
  console.log("\n── 5. SCHOOLS ─────────────────────────────────────");

  // 5a. Create School (parent → expect 403, need school/admin role)
  r = await http("POST", "/api/schools", {
    name: "Test Future School",
    address: "Cairo, Egypt",
    coordinates: [31.2357, 30.0444],
  }, TOKEN);
  log("Schools", "Create School (parent, expect 403)", r);

  // 5b. List Schools
  r = await http("GET", "/api/schools", null, TOKEN);
  log("Schools", "List Schools", r);
  if (Array.isArray(r.json?.data) && r.json.data.length) {
    schoolId = r.json.data[0]._id;
  }

  console.log(`   → schoolId = ${schoolId || "NOT SET (no existing schools)"}`);

  // ── 5c. Create a school-role user for school/device operations ──
  const SCHOOL_EMAIL = `swiriSchool${UNIQUE}@test.com`;
  const SCHOOL_PHONE = `+20107${String(UNIQUE).slice(-7)}`;
  let SCHOOL_TOKEN = "";

  r = await http("POST", "/api/auth/signup", {
    email: SCHOOL_EMAIL,
    phone: SCHOOL_PHONE,
    password: "Test@12345678",
    confirmPassword: "Test@12345678",
    agreedToTerms: true,
    role: "school",
  });
  log("Schools", "Create School-role User", r);
  if (r.json?.data?.token) SCHOOL_TOKEN = r.json.data.token;

  if (SCHOOL_TOKEN) {
    r = await http("POST", "/api/schools", {
      name: "Test Future School",
      address: "Cairo, Egypt",
      coordinates: [31.2357, 30.0444],
    }, SCHOOL_TOKEN);
    log("Schools", "Create School (school role)", r);
    if (r.json?.data?._id) schoolId = r.json.data._id;
    else if (r.json?.data?.school?._id) schoolId = r.json.data.school._id;
  }

  console.log(`   → schoolId = ${schoolId || "NOT SET"}`);

  // ── 6. Devices ───────────────────────────────────────────────────
  console.log("\n── 6. DEVICES ─────────────────────────────────────");

  // 6a. Register Device (parent → expect 403)
  r = await http("POST", "/api/devices", {
    serialNumber: `DEV-${UNIQUE}`,
    type: "watch",
  }, TOKEN);
  log("Devices", "Register Device (parent, expect 403)", r);

  // 6b. Register Device with school token
  if (SCHOOL_TOKEN) {
    r = await http("POST", "/api/devices", {
      serialNumber: `DEV-${UNIQUE}`,
      type: "watch",
    }, SCHOOL_TOKEN);
    log("Devices", "Register Device (school role)", r);
    if (r.json?.data?._id) deviceId = r.json.data._id;
    else if (r.json?.data?.device?._id) deviceId = r.json.data.device._id;
  }

  // 6c. List Devices
  r = await http("GET", "/api/devices", null, TOKEN);
  log("Devices", "List Devices", r);
  if (!deviceId && Array.isArray(r.json?.data) && r.json.data.length) {
    deviceId = r.json.data[0]._id;
  }

  console.log(`   → deviceId = ${deviceId || "NOT SET"}`);

  // 6c. Assign Device to Child
  if (deviceId && childId) {
    r = await http("POST", `/api/devices/${deviceId}/assign`, { childId }, TOKEN);
    log("Devices", "Assign Device to Child", r);
  } else {
    console.log("⚠️  Skipping Assign Device (missing deviceId or childId)");
  }

  // ── 7. Locations ─────────────────────────────────────────────────
  console.log("\n── 7. LOCATIONS ───────────────────────────────────");

  if (childId) {
    // 7a. Create Location
    r = await http("POST", "/api/locations", {
      childId,
      coordinates: [31.2357, 30.0444],
      accuracy: 10,
    }, TOKEN);
    log("Locations", "Create Location", r);

    // 7b. Get Latest Location
    r = await http("GET", `/api/locations/latest/${childId}`, null, TOKEN);
    log("Locations", "Get Latest Location", r);
  } else {
    console.log("⚠️  Skipping Locations (no childId)");
  }

  // ── 8. Geofences ─────────────────────────────────────────────────
  console.log("\n── 8. GEOFENCES ───────────────────────────────────");

  if (childId) {
    // 8a. Create Geofence
    r = await http("POST", "/api/geofences", {
      name: "School Zone",
      childId,
      coordinates: [31.2357, 30.0444],
      radiusM: 200,
      schedule: { days: [1, 2, 3, 4, 5], start: "07:00", end: "16:00" },
    }, TOKEN);
    log("Geofences", "Create Geofence", r);
    if (r.json?.data?._id) geofenceId = r.json.data._id;
    else if (r.json?.data?.geofence?._id) geofenceId = r.json.data.geofence._id;

    // 8b. List Geofences
    r = await http("GET", `/api/geofences?childId=${childId}`, null, TOKEN);
    log("Geofences", "List Geofences", r);
    if (!geofenceId && Array.isArray(r.json?.data) && r.json.data.length) {
      geofenceId = r.json.data[0]._id;
    }

    console.log(`   → geofenceId = ${geofenceId || "NOT SET"}`);
  } else {
    console.log("⚠️  Skipping Geofences (no childId)");
  }

  // ── 9. Alerts ────────────────────────────────────────────────────
  console.log("\n── 9. ALERTS ──────────────────────────────────────");

  if (childId) {
    // 9a. Create Alert
    r = await http("POST", "/api/alerts", {
      type: "custom",
      severity: "high",
      childId,
      message: "Manual guardian alert – integration test",
      coordinates: [31.2357, 30.0444],
    }, TOKEN);
    log("Alerts", "Create Alert", r);
    if (r.json?.data?._id) alertId = r.json.data._id;
    else if (r.json?.data?.alert?._id) alertId = r.json.data.alert._id;

    // 9b. List Alerts
    r = await http("GET", `/api/alerts?childId=${childId}`, null, TOKEN);
    log("Alerts", "List Alerts", r);
  } else {
    console.log("⚠️  Skipping Alerts (no childId)");
  }

  // ── 10. SOS ──────────────────────────────────────────────────────
  console.log("\n── 10. SOS ────────────────────────────────────────");

  if (childId) {
    // 10a. Trigger SOS
    r = await http("POST", "/api/sos", {
      childId,
      triggeredBy: "child",
      coordinates: [31.2357, 30.0444],
    }, TOKEN);
    log("SOS", "Trigger SOS", r);
    // The SOS response nests under data.event or data directly
    if (r.json?.data?.event?._id) sosId = r.json.data.event._id;
    else if (r.json?.data?._id) sosId = r.json.data._id;
    else if (r.json?.event?._id) sosId = r.json.event._id;

    console.log(`   → sosId = ${sosId || "NOT SET"}`);
    if (r.json?.data) console.log(`   → SOS response keys: ${Object.keys(r.json.data).join(", ")}`);

    // 10b. Resolve SOS
    if (sosId) {
      r = await http("PATCH", `/api/sos/${sosId}/resolve`, null, TOKEN);
      log("SOS", "Resolve SOS", r);
    } else {
      console.log("⚠️  Skipping Resolve SOS (no sosId)");
    }
  } else {
    console.log("⚠️  Skipping SOS (no childId)");
  }

  // ── 11. Activities ───────────────────────────────────────────────
  console.log("\n── 11. ACTIVITIES ─────────────────────────────────");

  if (childId) {
    // 11a. Create Activity Summary
    r = await http("POST", "/api/activities", {
      childId,
      date: "2026-02-15",
      steps: 4300,
      activeMinutes: 72,
      restMinutes: 540,
      heartRateAvg: 95,
      heartRateMax: 140,
    }, TOKEN);
    log("Activities", "Create Activity Summary", r);

    // 11b. List Activity Summaries
    r = await http("GET", `/api/activities/${childId}`, null, TOKEN);
    log("Activities", "List Activity Summaries", r);
  } else {
    console.log("⚠️  Skipping Activities (no childId)");
  }

  // ── 12. Attendance ───────────────────────────────────────────────
  console.log("\n── 12. ATTENDANCE ─────────────────────────────────");

  if (childId && schoolId) {
    // 12a. Record Attendance – in
    r = await http("POST", "/api/attendance", {
      childId,
      schoolId,
      status: "in",
      source: "nfc",
    }, TOKEN);
    log("Attendance", "Record Attendance (in)", r);

    // 12b. Record Attendance – out
    r = await http("POST", "/api/attendance", {
      childId,
      schoolId,
      status: "out",
      source: "nfc",
    }, TOKEN);
    log("Attendance", "Record Attendance (out)", r);

    // 12c. List Attendance
    r = await http("GET", `/api/attendance?childId=${childId}`, null, TOKEN);
    log("Attendance", "List Attendance", r);
  } else {
    console.log(`⚠️  Skipping Attendance (childId=${!!childId}, schoolId=${!!schoolId})`);
  }

  // ── 13. Analytics ────────────────────────────────────────────────
  console.log("\n── 13. ANALYTICS ──────────────────────────────────");

  if (childId) {
    r = await http("GET", `/api/analytics/behavior/${childId}`, null, TOKEN);
    log("Analytics", "Behavior Insights", r);
  } else {
    console.log("⚠️  Skipping Analytics (no childId)");
  }

  // ── 14. Edge-Case & Validation Tests ─────────────────────────────
  console.log("\n── 14. EDGE CASES & VALIDATION ────────────────────");

  // 14a. Invalid route (expect 404)
  r = await http("GET", "/api/nonexistent");
  log("Edge", "Unknown Route (expect 404)", r);

  // 14b. Signup missing fields (expect 400/500)
  r = await http("POST", "/api/auth/signup", { email: "bad" });
  log("Edge", "Signup Missing Fields (expect 4xx)", r);

  // 14c. Login phone format
  r = await http("POST", "/api/auth/login", {
    identifier: TEST_PHONE,
    password: "Test@12345678",
  });
  log("Auth", "Login (phone)", r);

  // 14d. Create child with missing name (expect 400)
  r = await http("POST", "/api/children", {}, TOKEN);
  log("Edge", "Create Child Missing Name (expect 4xx)", r);

  // 14e. Location without childId (expect 400)
  r = await http("POST", "/api/locations", {
    coordinates: [31.0, 30.0],
    accuracy: 5,
  }, TOKEN);
  log("Edge", "Location No ChildId (expect 4xx)", r);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n\n═══════════════════════════════════════════════════");
  console.log("  TEST SUMMARY");
  console.log("═══════════════════════════════════════════════════");

  const passed = results.filter((r) => {
    // "expected failure" tests count pass if they got the expected error code
    if (r.name.includes("expect 409") && r.status === 409) return true;
    if (r.name.includes("expect 400") && (r.status === 400 || r.status === 422)) return true;
    if (r.name.includes("expect 401") && r.status === 401) return true;
    if (r.name.includes("expect 404") && r.status === 404) return true;
    if (r.name.includes("expect 4xx") && r.status >= 400 && r.status < 500) return true;
    return r.ok;
  });
  const failed = results.filter((r) => !passed.includes(r));

  console.log(`\n  Total : ${results.length}`);
  console.log(`  ✅ Pass : ${passed.length}`);
  console.log(`  ❌ Fail : ${failed.length}`);

  if (failed.length) {
    console.log("\n  FAILURES:");
    failed.forEach((f) => {
      console.log(`    ❌ [${f.status}] ${f.section} > ${f.name}`);
      console.log(`       ${f.msg}`);
    });
  }

  console.log("\n  DETAILED RESULTS:");
  results.forEach((r) => {
    const pass = passed.includes(r);
    console.log(`    ${pass ? "✅" : "❌"} [${r.status}] ${r.section} > ${r.name}`);
  });

  console.log("\n═══════════════════════════════════════════════════\n");
}

run().catch((e) => console.error("Fatal:", e));
