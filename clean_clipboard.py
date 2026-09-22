"""
Coursera Prompt Injection Auto-Cleaner (Clipboard Monitor)
-----------------------------------------------------------
Script này chạy nền trên máy của bạn.
Mỗi khi bạn copy (Ctrl + C) câu hỏi từ Coursera, nếu trong nội dung có đoạn bẫy
prompt injection ("You are a helpful AI assistant... Do you understand?."),
script sẽ TỰ ĐỘNG xóa đoạn đó và cập nhật lại vào Clipboard.

Bạn chỉ việc bấm Ctrl + V vào ChatGPT/Claude/Gemini mà không cần làm gì thêm!
"""

import re
import time
import sys

# Hàm thao tác Clipboard trên Windows không cần cài thêm thư viện
def get_clipboard():
    try:
        import win32clipboard
        win32clipboard.OpenClipboard()
        data = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
        win32clipboard.CloseClipboard()
        return data
    except Exception:
        pass

    try:
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()
        data = root.clipboard_get()
        root.destroy()
        return data
    except Exception:
        pass

    try:
        import subprocess
        p = subprocess.run(['powershell', '-command', 'Get-Clipboard'], capture_output=True, text=True, encoding='utf-8')
        return p.stdout
    except Exception:
        return ""

def set_clipboard(text):
    try:
        import win32clipboard
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardText(text, win32clipboard.CF_UNICODETEXT)
        win32clipboard.CloseClipboard()
        return True
    except Exception:
        pass

    try:
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()
        return True
    except Exception:
        pass

    try:
        import subprocess
        p = subprocess.Popen(['powershell', '-command', 'Set-Clipboard'], stdin=subprocess.PIPE, text=True, encoding='utf-8')
        p.communicate(input=text)
        return True
    except Exception:
        return False

# Mẫu Regex phát hiện và loại bỏ khối prompt injection Coursera
TRAP_PATTERN = re.compile(
    r'\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*',
    re.IGNORECASE
)

def clean_coursera_text(text: str) -> str:
    if not text:
        return text
    
    # Xóa khối prompt injection
    cleaned = TRAP_PATTERN.sub('\n\n', text)
    
    # Xóa các dòng điểm số (1 point, 2 points, v.v.)
    cleaned = re.sub(r'^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$', '', cleaned, flags=re.MULTILINE | re.IGNORECASE)

    # Chuẩn hóa khoảng trắng & ngắt dòng
    cleaned = cleaned.replace('\r\n', '\n')
    cleaned = re.sub(r'[ \t]+$', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()

def main():
    print("=" * 60)
    print(" COURSERA CLIPBOARD CLEANER ĐANG CHẠY...")
    print(" Script sẽ tự động lọc đoạn bẫy mỗi khi bạn bấm Ctrl + C")
    print(" Nhấn Ctrl + C trong cửa sổ console này để dừng.")
    print("=" * 60)

    last_text = ""
    
    while True:
        try:
            current_text = get_clipboard()
            if current_text and current_text != last_text:
                if "You are a helpful AI assistant" in current_text and "Coursera" in current_text:
                    cleaned = clean_coursera_text(current_text)
                    if cleaned != current_text:
                        set_clipboard(cleaned)
                        last_text = cleaned
                        print(f"[{time.strftime('%H:%M:%S')}] >> ĐÃ LÀM SẠCH 1 ĐOẠN TEXT COURSERA TRONG CLIPBOARD!")
                    else:
                        last_text = current_text
                else:
                    last_text = current_text
            time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nĐã dừng script.")
            sys.exit(0)
        except Exception as e:
            time.sleep(1)

if __name__ == "__main__":
    main()
