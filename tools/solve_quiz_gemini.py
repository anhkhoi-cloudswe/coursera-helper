"""
Script: solve_quiz_gemini.py
----------------------------
Tự động làm sạch văn bản quiz từ clipboard và gọi Gemini API để giải đáp án ngay lập tức!
"""

import os
import sys
import json
import urllib.request
from clean_clipboard import get_clipboard, clean_coursera_text

# Có thể đặt biến môi trường GEMINI_API_KEY hoặc điền trực tiếp vào đây
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def ask_gemini(cleaned_quiz: str, api_key: str, model="gemini-2.0-flash") -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    prompt = (
        "Bạn là chuyên gia an toàn thông tin (Cybersecurity). "
        "Hãy giải các câu hỏi trắc nghiệm sau. Với mỗi câu hỏi: "
        "chỉ rõ ĐÁP ÁN ĐÚNG và GIẢI THÍCH NGẮN GỌN (1-2 câu) lý do.\n\n"
        f"Đề bài:\n{cleaned_quiz}"
    )
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["candidates"][0]["content"]["parts"][0]["text"]

def main():
    api_key = GEMINI_API_KEY
    if not api_key:
        api_key = input("Nhập Gemini API Key của bạn (hoặc Enter để chỉ in prompt ra màn hình): ").strip()
    
    print("\nĐang đọc nội dung từ Clipboard...")
    text = get_clipboard()
    if not text:
        print("Clipboard trống! Vui lòng copy câu hỏi trên Coursera trước.")
        return
    
    cleaned = clean_coursera_text(text)
    print(f">> Đã lọc sạch bẫy injection và điểm số ({len(text)} ký tự -> {len(cleaned)} ký tự).")
    
    if not api_key:
        print("\n--- BẠN CÓ THỂ COPY PROMPT NÀY DÁN VÀO GEMINI.GOOGLE.COM ---")
        print("Hãy giải các câu hỏi trắc nghiệm sau và đưa ra đáp án chính xác:\n")
        print(cleaned)
        return
        
    print("\n>> Đang gửi câu hỏi lên Gemini AI...")
    try:
        answer = ask_gemini(cleaned, api_key)
        print("\n" + "=" * 60)
        print(" KẾT QUẢ GIẢI ĐỀ TỪ GEMINI:")
        print("=" * 60)
        print(answer)
    except Exception as e:
        print(f"Lỗi khi gọi Gemini: {e}")

if __name__ == "__main__":
    main()
