# WebDou — Car Split Browser

WebDou là một web app chia đôi màn hình, tối ưu cho màn hình ngang / cảm ứng trên xe. Mỗi bên có thanh điều khiển và menu truy cập nhanh độc lập.

## Tính năng

- Chia màn hình 70/30, 60/40, 50/50, 40/60, 30/70.
- Kéo divider bằng chuột hoặc cảm ứng.
- Bố cục trái/phải hoặc trên/dưới, có Auto theo hướng màn hình.
- Menu nhanh riêng cho từng pane.
- Google Maps: nhập địa điểm, dùng Maps Embed API nếu cấu hình key hoặc fallback `output=embed`.
- YouTube: tự đổi URL video, Shorts và playlist sang YouTube Embed.
- Website tùy ý bằng iframe (phụ thuộc chính sách `X-Frame-Options` / CSP của website đích).
- Swap, Focus, fullscreen pane, fullscreen toàn trang.
- Lock UI để ẩn thanh điều khiển.
- Favorites tùy chỉnh.
- Lưu trạng thái/cài đặt bằng `localStorage`.
- PWA shell / Add to Home Screen.
- GitHub Pages deployment bằng GitHub Actions.

## Chạy local

Do Service Worker cần HTTP(S), nên chạy bằng web server thay vì double-click file HTML.

```bash
python -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## Deploy GitHub Pages

Workflow `.github/workflows/pages.yml` sẽ deploy static site từ branch `main`.

Trong repository GitHub:

1. **Settings → Pages**.
2. **Source → GitHub Actions**.
3. Push lên `main`.
4. Workflow **Deploy WebDou to GitHub Pages** sẽ publish site.

Với repo `thanhan671/webdou`, URL Pages mặc định sẽ là:

`https://thanhan671.github.io/webdou/`

## Lưu ý về iframe

Không có web app nào có thể buộc mọi website hiển thị trong iframe. Website đích có thể chặn nhúng bằng `X-Frame-Options` hoặc CSP `frame-ancestors`.

WebDou xử lý riêng link YouTube video/playlist và Google Maps để tăng khả năng hoạt động trong split-screen. Với website chặn iframe, dùng nút **↗** để mở trực tiếp.

## API keys

API key được lưu cục bộ trong trình duyệt bằng `localStorage`. Nếu triển khai công khai, chỉ dùng browser key đã giới hạn theo HTTP referrer/domain và giới hạn API phù hợp.


## WebDou v2

- Google Maps opens immediately inside the selected pane with its own search bar and current-location button.
- YouTube opens immediately as an in-pane browser/search experience instead of asking for a pasted link.
- YouTube search/browse uses the official YouTube Data API; add a restricted API key once in Settings. Direct YouTube video/playlist links still play without a Data API key.
- First launch defaults to Maps on the left and YouTube on the right.
