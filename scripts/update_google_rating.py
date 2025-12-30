import json
import requests
import time
from datetime import date

import os
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not API_KEY:
    raise SystemExit("請先設定環境變數 GOOGLE_MAPS_API_KEY")


INPUT_FILE = "../kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json"
OUTPUT_FILE = "../overrides.json"

FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def find_place_id(name, address):
    query = f"{name} {address}"
    params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id",
        "language": "zh-TW",
        "key": API_KEY,
    }
    r = requests.get(FIND_PLACE_URL, params=params, timeout=10)
    data = r.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return None
    return candidates[0]["place_id"]


def get_rating(place_id):
    params = {
        "place_id": place_id,
        "fields": "rating,user_ratings_total",
        "language": "zh-TW",
        "key": API_KEY,
    }
    r = requests.get(DETAILS_URL, params=params, timeout=10)
    data = r.json().get("result", {})
    return (
        data.get("rating"),
        data.get("user_ratings_total"),
    )


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        parking_lots = json.load(f)

    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            overrides = json.load(f)
    except FileNotFoundError:
        overrides = {}

    for item in parking_lots:
        name = item["parking_name"]
        address = item["address"]

        print(f"🔍 處理：{name}")

        place_id = find_place_id(name, address)
        if not place_id:
            print("  ⚠ 找不到 place_id")
            continue

        rating, review_count = get_rating(place_id)
        if rating is None:
            print("  ⚠ 無評分資料")
            continue

        overrides[name] = {
            "google_rating": rating,
            "google_review_count": review_count,
            "place_id": place_id,
            "as_of": date.today().isoformat(),
        }

        print(f"  ⭐ {rating}（{review_count} 則）")

        time.sleep(1)  # 避免太快被限速

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(overrides, f, ensure_ascii=False, indent=2)

    print("✅ overrides.json 更新完成")


if __name__ == "__main__":
    main()

