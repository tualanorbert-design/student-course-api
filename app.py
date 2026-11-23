from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datetime import datetime
from itertools import count

app = Flask(__name__)
CORS(app)

# ---------- In-memory data ----------
ids = {k: count(1) for k in ("students", "courses", "enrollments", "announcements")}
db = {
    "students": [],
    "courses": [
        {"id": next(ids["courses"]), "code": "CS101", "title": "Intro to Programming", "instructor": "Dr. Reyes", "capacity": 30},
        {"id": next(ids["courses"]), "code": "MA201", "title": "Calculus II", "instructor": "Prof. Lim", "capacity": 25},
        {"id": next(ids["courses"]), "code": "EN110", "title": "Academic Writing", "instructor": "Ms. Cruz", "capacity": 20},
    ],
    "enrollments": [],
    "announcements": [],
}

def enrolled_count(course_id):
    return sum(1 for e in db["enrollments"] if e["course_id"] == course_id)

def course_view(c):
    return {**c, "enrolled": enrolled_count(c["id"]), "open_slots": c["capacity"] - enrolled_count(c["id"])}

def find(table, item_id):
    return next((x for x in db[table] if x["id"] == item_id), None)

def error(msg, code=400):
    return jsonify({"error": msg}), code

# ---------- Pages ----------
@app.route("/")
def index(): return render_template("index.html")

@app.route("/students")
def students_page(): return render_template("students.html")

@app.route("/courses")
def courses_page(): return render_template("courses.html")

@app.route("/enrollment")
def enrollment_page(): return render_template("enrollment.html")

@app.route("/announcements")
def announcements_page(): return render_template("announcement.html")

# ---------- API ----------
@app.get("/api/health")
def health(): return jsonify({"status": "online"})

@app.get("/api/students")
def get_students(): return jsonify(db["students"])

@app.post("/api/students")
def add_student():
    d = request.get_json(silent=True) or {}
    if not d.get("name") or not d.get("email"):
        return error("Name and email are required.")
    if any(s["email"].lower() == d["email"].lower() for s in db["students"]):
        return error("A student with this email already exists.", 409)
    s = {"id": next(ids["students"]), "name": d["name"], "email": d["email"], "program": d.get("program", "")}
    db["students"].append(s)
    return jsonify(s), 201

@app.delete("/api/students/<int:sid>")
def delete_student(sid):
    if not find("students", sid): return error("Student not found.", 404)
    db["students"] = [s for s in db["students"] if s["id"] != sid]
    db["enrollments"] = [e for e in db["enrollments"] if e["student_id"] != sid]
    return "", 204

@app.get("/api/courses")
def get_courses(): return jsonify([course_view(c) for c in db["courses"]])

@app.post("/api/courses")
def add_course():
    d = request.get_json(silent=True) or {}
    if not d.get("code") or not d.get("title"):
        return error("Course code and title are required.")
    try: cap = int(d.get("capacity", 30))
    except ValueError: return error("Capacity must be a number.")
    c = {"id": next(ids["courses"]), "code": d["code"], "title": d["title"],
         "instructor": d.get("instructor", ""), "capacity": cap}
    db["courses"].append(c)
    return jsonify(course_view(c)), 201

@app.delete("/api/courses/<int:cid>")
def delete_course(cid):
    if not find("courses", cid): return error("Course not found.", 404)
    db["courses"] = [c for c in db["courses"] if c["id"] != cid]
    db["enrollments"] = [e for e in db["enrollments"] if e["course_id"] != cid]
    return "", 204

@app.get("/api/enrollments")
def get_enrollments():
    out = []
    for e in db["enrollments"]:
        s, c = find("students", e["student_id"]), find("courses", e["course_id"])
        out.append({**e, "student_name": s["name"] if s else "?", "course_code": c["code"] if c else "?",
                    "course_title": c["title"] if c else "?"})
    return jsonify(out)

@app.post("/api/enrollments")
def enroll():
    d = request.get_json(silent=True) or {}
    try: sid, cid = int(d.get("student_id")), int(d.get("course_id"))
    except (TypeError, ValueError): return error("Choose a student and a course.")
    if not find("students", sid) or not find("courses", cid): return error("Student or course not found.", 404)
    if any(e["student_id"] == sid and e["course_id"] == cid for e in db["enrollments"]):
        return error("This student is already enrolled in the course.", 409)
    if course_view(find("courses", cid))["open_slots"] <= 0:
        return error("This course has no open slots.", 409)
    e = {"id": next(ids["enrollments"]), "student_id": sid, "course_id": cid,
         "enrolled_at": datetime.now().strftime("%Y-%m-%d %H:%M")}
    db["enrollments"].append(e)
    return jsonify(e), 201

@app.delete("/api/enrollments/<int:eid>")
def drop(eid):
    if not find("enrollments", eid): return error("Enrollment not found.", 404)
    db["enrollments"] = [e for e in db["enrollments"] if e["id"] != eid]
    return "", 204

@app.get("/api/announcements")
def get_announcements(): return jsonify(list(reversed(db["announcements"])))

@app.post("/api/announcements")
def add_announcement():
    d = request.get_json(silent=True) or {}
    if not d.get("title") or not d.get("body"): return error("Title and message are required.")
    a = {"id": next(ids["announcements"]), "title": d["title"], "body": d["body"],
         "posted_at": datetime.now().strftime("%Y-%m-%d %H:%M")}
    db["announcements"].append(a)
    return jsonify(a), 201

@app.delete("/api/announcements/<int:aid>")
def delete_announcement(aid):
    if not find("announcements", aid): return error("Announcement not found.", 404)
    db["announcements"] = [a for a in db["announcements"] if a["id"] != aid]
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)
