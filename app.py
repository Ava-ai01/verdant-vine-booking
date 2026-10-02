from flask import Flask, request, jsonify, render_template
import json
import os
import re
from datetime import date

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BOOKINGS_FILE = os.path.join(BASE_DIR, "bookings.json")

SERVICE_TYPES = [
    "Private Chef Dinner",
    "Catering Consultation",
    "Meal Prep Plan",
    "Cooking Class",
    "Event Catering",
]

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PHONE_DIGITS_RE = re.compile(r"^\+?[0-9\s().\-]{7,20}$")


def validate_booking(data):
    """Validate a booking payload. Returns (ok, errors) where errors is a
    dict mapping field name -> friendly error message."""
    errors = {}

    name = (data.get("name") or "").strip()
    if len(name) < 2:
        errors["name"] = "Please enter your full name so we know who we're talking to."

    email = (data.get("email") or "").strip()
    if not EMAIL_RE.match(email):
        errors["email"] = "That email doesn't look quite right — please double-check it."

    phone = (data.get("phone") or "").strip()
    if not PHONE_DIGITS_RE.match(phone):
        errors["phone"] = "Please enter a valid phone number (e.g. 555-123-4567)."

    event_date = (data.get("event_date") or "").strip()
    try:
        parsed = date.fromisoformat(event_date)
        if parsed <= date.today():
            errors["event_date"] = "Your event date needs to be in the future — pick a day after today."
    except (ValueError, TypeError):
        errors["event_date"] = "Please choose a valid date for your event."

    guests_raw = (data.get("guests") or "").strip() if isinstance(data.get("guests"), str) else data.get("guests")
    try:
        guests = int(guests_raw)
        if guests < 1 or guests > 500:
            errors["guests"] = "Guest count must be between 1 and 500 — tell us if your event is bigger!"
    except (TypeError, ValueError):
        errors["guests"] = "Please enter a number for the guest count."

    service_type = (data.get("service_type") or "").strip()
    if service_type not in SERVICE_TYPES:
        errors["service_type"] = "Please choose a service from the list."

    message = (data.get("message") or "")
    if len(message) > 1000:
        errors["message"] = "Keep your message under 1,000 characters, please."

    return (len(errors) == 0, errors)


def load_bookings():
    if os.path.exists(BOOKINGS_FILE):
        with open(BOOKINGS_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def save_bookings(bookings):
    with open(BOOKINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(bookings, f, indent=2)


@app.route("/")
def index():
    return render_template("index.html", service_types=SERVICE_TYPES)


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data = request.get_json(force=True, silent=True) or {}
    ok, errors = validate_booking(data)
    if not ok:
        return jsonify({"success": False, "errors": errors}), 400

    bookings = load_bookings()
    ref = "BC-%s-%03d" % (date.today().strftime("%Y%m%d"), len(bookings) + 1)
    booking = {
        "reference": ref,
        "name": data["name"].strip(),
        "email": data["email"].strip(),
        "phone": data["phone"].strip(),
        "event_date": data["event_date"].strip(),
        "guests": int(data["guests"]) if not isinstance(data.get("guests"), int) else data["guests"],
        "service_type": data["service_type"].strip(),
        "message": (data.get("message") or "").strip(),
        "created_at": date.today().isoformat(),
    }
    bookings.append(booking)
    save_bookings(bookings)

    return jsonify({
        "success": True,
        "reference": ref,
        "message": "Thanks, %s! Your %s request is in — we'll confirm by email within 24 hours."
        % (booking["name"].split()[0], booking["service_type"]),
    }), 201


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5007, debug=False)
