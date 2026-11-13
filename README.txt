KENFLIX - GITHUB PAGES (HTML/CSS/JAVASCRIPT)
Phiên bản chuyển đổi tĩnh: 1.1.3

CÀI ĐẶT GITHUB PAGES
1. Tạo GitHub repository, ví dụ kenflix.
2. Upload index.html, 404.html, README.txt và thư mục assets vào thư mục gốc repository.
3. Mở Settings > Pages.
4. Chọn Deploy from a branch, branch main, folder /(root), rồi Save.
5. Chờ GitHub Pages xuất bản website.

CẤU TRÚC
- index.html: trang chính, không cần PHP
- 404.html: hỗ trợ URL sạch khi tải lại trang trên GitHub Pages
- assets/app.js: giao diện và logic Kenflix
- assets/app.css: giao diện

API / ĐIỀU KIỆN QUAN TRỌNG
- Bản này gọi trực tiếp https://phimapi.com từ trình duyệt, không còn api.php.
- API phim vẫn phụ thuộc dịch vụ PhimAPI và chính sách CORS của họ. Nếu PhimAPI chặn CORS, trang không thể tải dữ liệu trực tiếp; khi đó cần proxy API (ví dụ Cloudflare Worker) hoặc tiếp tục dùng hosting PHP. GitHub Pages không chạy PHP.
- Link phát phim, ảnh và nội dung phụ thuộc nhà cung cấp bên ngoài.
- HLS.js dùng CDN jsDelivr; Safari/iPhone có thể dùng HLS native.
- Tiếp tục xem / yêu thích lưu trên trình duyệt bằng localStorage, không đồng bộ giữa thiết bị.

URL SẠCH
GitHub Pages dùng 404.html làm fallback cho đường dẫn /phim/... và /watch/... . Base path tự nhận diện với repository dạng https://TEN.github.io/kenflix/.
