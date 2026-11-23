const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (isError ? " error" : "");
  setTimeout(() => (t.className = ""), 2800);
}

async function api(path, method = "GET", body) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function checkApi() {
  let online = true;
  try { await api("/health"); } catch { online = false; }
  document.querySelectorAll(".api-status").forEach((el) => {
    el.textContent = online ? "API online" : "API offline";
    el.classList.toggle("online", online);
  });
}

function table(cols, rows, empty) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function submitForm(form, endpoint, done, message) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api(endpoint, "POST", Object.fromEntries(new FormData(form)));
      form.reset();
      toast(message);
      done();
    } catch (err) { toast(err.message, true); }
  });
}

async function remove(endpoint, id, page, message) {
  try { await api(`${endpoint}/${id}`, "DELETE"); toast(message); pages[page](); }
  catch (err) { toast(err.message, true); }
}

/* ---------- Pages ---------- */
const pages = {
  async dashboard() {
    const [students, courses, enrollments, notes] = await Promise.all(
      ["/students", "/courses", "/enrollments", "/announcements"].map((p) => api(p)));
    $("#stat-students").textContent = students.length;
    $("#stat-courses").textContent = courses.length;
    $("#stat-enrollments").textContent = enrollments.length;
    $("#stat-available").textContent = courses.filter((c) => c.open_slots > 0).length;
    $("#recent").innerHTML = table(
      [["Student", (r) => esc(r.student_name)], ["Course", (r) => esc(r.course_code)], ["When", (r) => esc(r.enrolled_at)]],
      enrollments.slice(-5).reverse(), "No enrollments yet.");
    $("#notes").innerHTML = notes.length
      ? notes.slice(0, 3).map((a) => `<div class="note"><div><b>${esc(a.title)}</b><span>${esc(a.posted_at)}</span></div></div>`).join("")
      : `<p class="empty">No announcements yet.</p>`;
  },

  async students() {
    const rows = await api("/students");
    $("#list").innerHTML = table([
      ["Name", (r) => esc(r.name)], ["Email", (r) => esc(r.email)], ["Program", (r) => esc(r.program)],
      ["", (r) => `<button class="btn danger" onclick="remove('/students',${r.id},'students','Student removed')">Remove</button>`],
    ], rows, "No students yet. Add the first one above.");
  },

  async courses() {
    const rows = await api("/courses");
    $("#list").innerHTML = table([
      ["Code", (r) => `<b>${esc(r.code)}</b>`], ["Title", (r) => esc(r.title)], ["Instructor", (r) => esc(r.instructor)],
      ["Seats", (r) => `<span class="badge ${r.open_slots <= 0 ? "full" : ""}">${r.enrolled}/${r.capacity}</span>`],
      ["", (r) => `<button class="btn danger" onclick="remove('/courses',${r.id},'courses','Course removed')">Remove</button>`],
    ], rows, "No courses in the catalog.");
  },

  async enrollment() {
    const [s, c, rows] = await Promise.all([api("/students"), api("/courses"), api("/enrollments")]);
    $("#student_id").innerHTML = s.length
      ? s.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")
      : `<option value="">No students yet</option>`;
    $("#course_id").innerHTML = c.map((x) =>
      `<option value="${x.id}" ${x.open_slots <= 0 ? "disabled" : ""}>${esc(x.code)} – ${esc(x.title)} (${x.open_slots} open)</option>`).join("");
    $("#list").innerHTML = table([
      ["Student", (r) => esc(r.student_name)], ["Course", (r) => `${esc(r.course_code)} · ${esc(r.course_title)}`],
      ["Enrolled", (r) => esc(r.enrolled_at)],
      ["", (r) => `<button class="btn danger" onclick="remove('/enrollments',${r.id},'enrollment','Enrollment dropped')">Drop</button>`],
    ], rows, "No enrollment records yet.");
  },

  async announcements() {
    const rows = await api("/announcements");
    $("#list").innerHTML = rows.length
      ? rows.map((a) => `<div class="note"><div><b>${esc(a.title)}</b>${esc(a.body)}<span>${esc(a.posted_at)}</span></div>
          <button class="btn danger" onclick="remove('/announcements',${a.id},'announcements','Announcement removed')">Remove</button></div>`).join("")
      : `<p class="empty">No announcements yet. Post the first one above.</p>`;
  },
};

const formTargets = {
  students: ["/students", "Student added"],
  courses: ["/courses", "Course added"],
  enrollment: ["/enrollments", "Student enrolled"],
  announcements: ["/announcements", "Announcement posted"],
};

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  checkApi();
  const load = () => pages[page]().catch(() => toast("Can't reach the API. Start app.py and refresh.", true));
  $("#refresh")?.addEventListener("click", () => { checkApi(); load(); });
  if ($("#form") && formTargets[page]) submitForm($("#form"), formTargets[page][0], load, formTargets[page][1]);
  load();
});
