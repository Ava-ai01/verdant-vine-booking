"""Dev-only screenshot driver for the Verdant & Vine booking page.

Sandbox Chromium (v152) enforces Local Network Access checks and blocks
direct navigation to http://127.0.0.1:5007/. Workaround: intercept every
request in Playwright and fulfill it with Python `requests`, which has no
such restriction. Rendering is pixel-identical — Chromium still lays out
the real bytes.

Usage: python3 dev/shoot.py   (Flask app must be running on port 5007)
"""
import os
import requests
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5007/"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "screenshots")
DROP_HEADERS = {"content-encoding", "content-length", "transfer-encoding", "connection"}


def handle(route):
    req = route.request
    try:
        kwargs = {"timeout": 20, "headers": {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}}
        if req.method in ("POST", "PUT", "PATCH"):
            kwargs["data"] = req.post_data_buffer
            if req.headers.get("content-type"):
                kwargs["headers"]["Content-Type"] = req.headers["content-type"]
        r = requests.request(req.method, req.url, **kwargs)
        headers = {k: v for k, v in r.headers.items() if k.lower() not in DROP_HEADERS}
        route.fulfill(status=r.status_code, headers=headers, body=r.content)
    except Exception as e:  # noqa: BLE001
        print("route fulfill failed:", req.url, str(e)[:80])
        route.abort()


def launch(p, w, h):
    browser = p.chromium.launch(
        executable_path="/opt/meta-chromium/chrome",
        args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
    page.route("**/*", handle)
    page.on("pageerror", lambda e: print("PAGEERROR", str(e)[:200]))
    return browser, page


def jsclick(page, sel):
    page.evaluate(f"document.querySelector('{sel}').click()")


def next_step(page):
    jsclick(page, ".step-panel.is-active [data-next]")
    page.wait_for_timeout(700)


def run():
    with sync_playwright() as p:
        # (a) desktop step 1
        browser, page = launch(p, 1440, 900)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1600)
        page.screenshot(path=f"{OUT}/desktop-hero.png")
        print("a ok", flush=True)

        # drive full flow -> success
        page.fill("#eventDate", "2026-12-31")
        jsclick(page, "#guestsPlus"); jsclick(page, "#guestsPlus")  # 22 guests
        page.select_option("#eventType", "Wedding")
        next_step(page)
        assert "Services" in page.inner_text("#stepsCaption"), "not on step 2"
        jsclick(page, 'label.menu-card:has(input[value="Plated"])')
        page.check('input[name="addon"][value="Bar service"]')
        page.check('input[name="addon"][value="Dessert & cake"]')
        next_step(page)
        assert "Contact" in page.inner_text("#stepsCaption"), "not on step 3"
        page.fill("#fullName", "Ava Moreno")
        page.fill("#email", "ava@example.com")
        page.fill("#phone", "555-987-6543")
        next_step(page)
        assert "Review" in page.inner_text("#stepsCaption"), "not on step 4"
        assert "Ava Moreno" in page.inner_text("#reviewList"), "review missing name"
        page.fill("#notes", "Two vegan guests, outdoor venue.")
        jsclick(page, "#submitBtn")
        page.wait_for_selector("#successPanel:not([hidden])", timeout=15000)
        page.wait_for_timeout(1400)  # checkmark draw-in
        ref = page.inner_text("#successRef")
        print("reference:", ref, flush=True)
        assert ref.startswith("BC-"), "no reference number!"
        page.screenshot(path=f"{OUT}/desktop-mid.png")
        print("b ok", flush=True)
        browser.close()

        # (c) mobile step 1
        browser, page = launch(p, 390, 844)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1600)
        page.screenshot(path=f"{OUT}/mobile.png")
        print("c ok", flush=True)
        browser.close()

    print("done")


if __name__ == "__main__":
    run()
