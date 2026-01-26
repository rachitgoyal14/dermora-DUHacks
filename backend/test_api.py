import httpx
from datetime import datetime, timezone
from rich import print
from rich.table import Table
import traceback

# ============================================================================
# CONFIG
# ============================================================================

BASE_URL = "http://localhost:8000"
USER_ID = "00000000-0000-0000-0000-000000000000"

HEADERS = {"X-User-Id": USER_ID}

TEST_IMAGE = "test_face.jpg"
TEST_AUDIO = "test_voice.wav"

client = httpx.Client(timeout=120)

# ============================================================================
# RESULT TRACKING
# ============================================================================

PASSED = []
FAILED = []

def ok(name):
    PASSED.append(name)
    print(f"[green]✔ {name}[/green]")

def err(name, e):
    print(f"[red]✖ {name}[/red]")

    if isinstance(e, httpx.HTTPStatusError):
        resp = e.response
        print(f"[yellow]Status:[/yellow] {resp.status_code}")
        print(f"[yellow]URL:[/yellow] {resp.url}")
        print("[yellow]Response body:[/yellow]")
        try:
            print(resp.json())
        except Exception:
            print(resp.text[:500])  # Limit text output
    else:
        print(f"[yellow]Error type:[/yellow] {type(e).__name__}")
        print(f"[yellow]Error:[/yellow] {str(e)}")
        traceback.print_exc()

    FAILED.append((name, str(e)))
    print()

def run_test(name, fn):
    try:
        fn()
        ok(name)
    except Exception as e:
        err(name, e)

# ============================================================================
# MOOD
# ============================================================================

def test_mood():
    print("  → Testing mood questions...")
    r = client.get(f"{BASE_URL}/mood/questions")
    r.raise_for_status()

    print("  → Logging mood...")
    r = client.post(
        f"{BASE_URL}/mood/log",
        headers=HEADERS,
        json={
            "mood_score": 72,
            "stress": 30,
            "anxiety": 25,
            "sadness": 18,
            "energy": 80,
            "logged_at": datetime.now(timezone.utc).isoformat()
        }
    )
    r.raise_for_status()

    print("  → Getting mood history...")
    r = client.get(f"{BASE_URL}/mood/history", headers=HEADERS)
    r.raise_for_status()

# ============================================================================
# SKIN
# ============================================================================

def test_skin():
    print("  → Testing skin inference...")
    try:
        with open(TEST_IMAGE, "rb") as f:
            r = client.post(
                f"{BASE_URL}/skin/infer",
                files={"file": ("face.jpg", f, "image/jpeg")}
            )
        r.raise_for_status()
    except FileNotFoundError:
        print(f"  [yellow]⚠ Skipping: {TEST_IMAGE} not found[/yellow]")
        return

    print("  → Uploading skin image...")
    with open(TEST_IMAGE, "rb") as f:
        r = client.post(
            f"{BASE_URL}/skin/upload",
            headers=HEADERS,
            files={"file": ("face.jpg", f, "image/jpeg")},
            data={"image_type": "weekly"}
        )
    r.raise_for_status()
    image_id = r.json()["image_id"]

    print(f"  → Analyzing image {image_id}...")
    r = client.post(
        f"{BASE_URL}/skin/analyze/{image_id}",
        headers=HEADERS
    )
    r.raise_for_status()

    print("  → Getting my images...")
    r = client.get(f"{BASE_URL}/skin/my-images", headers=HEADERS)
    r.raise_for_status()

# ============================================================================
# REPORTS
# ============================================================================

def test_reports():
    print("  → Getting weekly report (JSON)...")
    r = client.get(f"{BASE_URL}/reports/weekly", headers=HEADERS)
    r.raise_for_status()
    print(f"    Status: {r.status_code}")
    report_data = r.json()
    print(f"    Week: {report_data.get('week_start')} to {report_data.get('week_end')}")

    print("  → Getting weekly report (HTML)...")
    r = client.get(f"{BASE_URL}/reports/weekly/html", headers=HEADERS)
    r.raise_for_status()
    print(f"    Status: {r.status_code}, HTML length: {len(r.text)} chars")

    print("  → Listing all reports...")
    r = client.get(f"{BASE_URL}/reports/weekly/list", headers=HEADERS)
    r.raise_for_status()
    reports = r.json()
    print(f"    Found {len(reports)} report(s)")
    
    # Optional: Test with limit parameter
    print("  → Testing list with limit...")
    r = client.get(f"{BASE_URL}/reports/weekly/list?limit=5", headers=HEADERS)
    r.raise_for_status()

# ============================================================================
# ENGAGEMENT
# ============================================================================

def test_engagement():
    print("  → Getting streak...")
    r = client.get(f"{BASE_URL}/engagement/streak", headers=HEADERS)
    r.raise_for_status()

    print("  → Checking in...")
    r = client.post(f"{BASE_URL}/engagement/check-in", headers=HEADERS)
    r.raise_for_status()

    print("  → Getting dashboard...")
    r = client.get(f"{BASE_URL}/engagement/dashboard", headers=HEADERS)
    r.raise_for_status()

    print("  → Getting daily insights...")
    r = client.get(f"{BASE_URL}/engagement/insights/daily", headers=HEADERS)
    r.raise_for_status()

# ============================================================================
# PREFERENCES
# ============================================================================

def test_preferences():
    print("  → Getting preferences...")
    r = client.get(f"{BASE_URL}/engagement/preferences", headers=HEADERS)
    r.raise_for_status()

    print("  → Updating preferences...")
    r = client.put(
        f"{BASE_URL}/engagement/preferences",
        headers=HEADERS,
        json={
            "notification_time": "09:30",
            "theme": "dark",
            "onboarding_completed": True,
            "skin_goals": ["acne", "hydration"],
            "reminder_enabled": True,
            "language": "en"
        }
    )
    r.raise_for_status()

# ============================================================================
# VOICE
# ============================================================================

def test_voice():
    print("  → Getting voice prompt...")
    r = client.get(f"{BASE_URL}/voice/prompt", headers=HEADERS)
    r.raise_for_status()

    print("  → Getting prompt preview...")
    r = client.get(f"{BASE_URL}/voice/prompt-preview/70")
    r.raise_for_status()

    print("  → Analyzing voice mood...")
    try:
        with open(TEST_AUDIO, "rb") as f:
            r = client.post(
                f"{BASE_URL}/voice/mood/analyze",
                headers=HEADERS,
                files={"audio": ("voice.wav", f, "audio/wav")}
            )
        r.raise_for_status()
    except FileNotFoundError:
        print(f"  [yellow]⚠ Skipping: {TEST_AUDIO} not found[/yellow]")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("\n[bold cyan]🚀 RUNNING FULL BACKEND SMOKE TEST[/bold cyan]\n")

    run_test("Mood", test_mood)
    run_test("Skin", test_skin)
    run_test("Reports", test_reports)
    run_test("Engagement", test_engagement)
    run_test("Preferences", test_preferences)
    run_test("Voice", test_voice)

    # ===================== SUMMARY =====================

    print("\n[bold]📊 TEST SUMMARY[/bold]\n")

    table = Table(show_header=True, header_style="bold")
    table.add_column("Test")
    table.add_column("Status")
    table.add_column("Error")

    for name in PASSED:
        table.add_row(name, "[green]PASS[/green]", "-")

    for name, error in FAILED:
        table.add_row(name, "[red]FAIL[/red]", error[:120])

    print(table)

    if FAILED:
        print(f"\n[red]❌ {len(FAILED)} test group(s) failed[/red]")
        exit(1)
    else:
        print("\n[bold green]✅ ALL TESTS PASSED[/bold green]\n")
        exit(0)