# Kết nối đăng nhập xã hội

Email/mật khẩu và Sign in with ChatGPT hoạt động ngay sau khi triển khai. Google, Facebook và GitHub được hỗ trợ trong mã nguồn, nhưng mỗi nền tảng cần một OAuth application do chủ dự án tạo.

Không đưa App Secret vào GitHub hay gửi qua chat. Lưu chúng dưới dạng environment secret của website.

## Biến môi trường

| Nền tảng | Client ID | Client Secret | Redirect URI mặc định |
| --- | --- | --- | --- |
| Google | `OAUTH_GOOGLE_CLIENT_ID` | `OAUTH_GOOGLE_CLIENT_SECRET` | `https://planary-vn-dashboard.vanthien04032004.chatgpt.site/api/auth/oauth/google/callback` |
| Facebook | `OAUTH_FACEBOOK_CLIENT_ID` | `OAUTH_FACEBOOK_CLIENT_SECRET` | `https://planary-vn-dashboard.vanthien04032004.chatgpt.site/api/auth/oauth/facebook/callback` |
| GitHub | `OAUTH_GITHUB_CLIENT_ID` | `OAUTH_GITHUB_CLIENT_SECRET` | `https://planary-vn-dashboard.vanthien04032004.chatgpt.site/api/auth/oauth/github/callback` |

Nếu cần dùng một callback khác, đặt thêm biến `OAUTH_<NỀN_TẢNG>_REDIRECT_URI`.

## Facebook

Tạo ứng dụng trong Meta for Developers, bật Facebook Login, rồi thêm URL callback Facebook ở bảng trên vào **Valid OAuth Redirect URIs**. Quyền yêu cầu là `email` và `public_profile`.

Sau khi các biến môi trường được thiết lập, nút Facebook sẽ sử dụng luồng OAuth chuẩn và ghép tài khoản bằng email nếu người dùng cho phép Facebook chia sẻ email đó.
