
```cmd
pnpm install
pnpm run start:dev
```

1panel:
地址:http://47.117.245.39:26267/
账号:jeffzhang1227

通过pm2命令查看nest日志:
pm2 logs management-backend --lines 50


## 忘记密码

登录页点击“忘记密码”，填写注册邮箱，获取六位验证码，再提交新密码和确认密码。成功后返回登录页，使用新密码登录。

- `POST /api/auth/reset-password/code`：`{ "email": "user@example.com" }`
- `POST /api/auth/reset-password`：`{ "email": "user@example.com", "code": "123456", "password": "new-password" }`
- 复用注册流程的 `MAIL_*` SMTP 配置；重置验证码有效期为 10 分钟，发送间隔为 60 秒，每邮箱每小时最多发送 5 次，验证错误 5 次后失效。
- 注册和重置验证码独立，只允许使用最新验证码一次。重置成功后，原 access token 和 refresh token 失效。
- 生产环境在启动新版服务前执行 `pnpm migration:run`，增加验证码用途字段和用户 token 版本字段。开发环境继续使用现有 TypeORM 自动同步配置。


## 邮箱验证码登录

登录页点击“邮箱验证码登录”，填写已注册的邮箱，获取并输入六位验证码即可登录，无需密码。未注册的邮箱需先注册，不会自动创建账号。

- `POST /api/auth/login/email/code`：`{ "email": "user@example.com" }`，请求发送登录验证码。
- `POST /api/auth/login/email`：`{ "email": "user@example.com", "code": "123456" }`，成功返回与密码登录一致的用户信息、access token 和 refresh token。
- 复用现有 `MAIL_*` SMTP 配置；登录验证码与注册、重置密码验证码独立，10 分钟内有效，仅最新验证码可使用一次。
- 每邮箱发送间隔为 60 秒，每小时最多 5 次，错误验证 5 次后失效。发送接口对未注册邮箱返回相同提示。
- 在已有忘记密码功能的数据库基础上，无需额外迁移；如尚未升级，先执行 `pnpm migration:run`。


## 通行密钥（Passkey）与手机扫码验证

已支持 WebAuthn 通行密钥绑定、列表、删除，以及免密码登录。面容、指纹或设备锁屏验证由系统完成，后端只保存凭证公钥，不接收生物特征。

### 使用方式

1. 先用密码或邮箱验证码登录，进入“账号设置 → 安全”。
2. 在“通行密钥”中填写名称，获取账号邮箱验证码，选择“此设备或密码管理器”或“其他手机”，完成系统验证后绑定。
3. 退出登录后，可使用“面容 / 指纹登录”。电脑端也可进入“二维码登录”，直接扫描网页显示的一次性二维码，在手机网页核对数字，再用手机上的通行密钥验证并确认电脑登录。
4. 可在安全页查看最近使用时间并删除丢失设备的通行密钥。删除后该凭证无法再次登录；已签发的登录凭证仍按现有会话规则处理。

建议首次在手机浏览器登录并绑定通行密钥。本机登录使用 `client-device` 提示并要求用户验证；具体面容、指纹或设备 PIN 由系统决定。二维码登录使用独立网页会话，不在电脑上调用 WebAuthn，因此不会先打开电脑的 Touch ID 窗口。手机扫码进入独立确认页后，才在手机上调用 WebAuthn 验证身份。

### 部署

- 构建和运行使用 Node.js 22 或更高版本（Docker 镜像已使用 Node 22）。
- 本地手动部署时，上线前执行 `pnpm migration:run`，创建 `sys_passkey` 和 `sys_passkey_challenge`。GitHub Actions 自动部署会先运行迁移，成功后再启动新版容器；容器明确使用生产模式并关闭自动同步。
- 设置后端环境变量（示例域名需替换为实际前端域名）：

```dotenv
WEBAUTHN_RP_ID=app.example.com
WEBAUTHN_ORIGIN=https://app.example.com
WEBAUTHN_RP_NAME=AGGREGATE
```

`WEBAUTHN_RP_ID` 是前端域名，不含协议、端口或路径；`WEBAUTHN_ORIGIN` 是准确的前端来源，包含协议及实际端口，不含路径和末尾斜杠。服务端不会根据请求 Host 动态信任域名。更改 RP ID 通常需要重新绑定通行密钥。生产未配置时功能关闭，密码/邮箱登录继续可用。

本机开发默认 `localhost` / `http://localhost:3001`。手机跨设备测试需使用可访问的 HTTPS 正式或测试域名；手机不能用电脑的 localhost 地址。网页扫码登录需要两台设备联网，不要求蓝牙或同一 Wi-Fi；手机浏览器和凭证提供程序需支持本站的通行密钥。绑定时如选择系统的“其他手机”方式，系统跨设备通行密钥流程可能仍需要蓝牙。保留邮箱验证码作为不支持环境的登录方式。

### 接口与验证

- 公开接口：`GET /api/auth/passkeys/config`、`POST /api/auth/passkeys/login/options`、`POST /api/auth/passkeys/login/verify`。
- 登录后接口：`GET /api/auth/passkeys`、`DELETE /api/auth/passkeys/:id`、`POST /api/auth/passkeys/register/code`、`POST /api/auth/passkeys/register/options`、`POST /api/auth/passkeys/register/verify`。
- options 请求可传 `{ "mode": "phone" }` 优先提示跨设备认证；省略或 `local` 允许本机/密码管理器选择。
- 绑定需专用账号邮箱验证码，与注册、登录、重置密码验证码隔离；已有登录会话不能绕过邮箱验证新增通行密钥。
- 服务端验证 challenge、origin、RP ID、用户在场与用户验证标志、公钥签名、账号 userHandle 和计数器；挑战有效期 5 分钟、提交后一次失效。绑定挑战还绑定账号及登录凭证版本，重置密码后旧绑定挑战失效。
- 每用户最多 10 把通行密钥，创建挑战按请求来源限频，过期挑战每小时清理。反向代理场景需按真实部署规划可信代理与边缘限频，不可信任任意客户端提交的转发头。

自动测试使用 ES256 密钥生成真实 WebAuthn attestation/assertion，覆盖真实验签、错误域名、伪造签名、缺少用户验证、重放、凭证撤销、账号隔离与数据库迁移。它不替代 iPhone / 安卓真机的面容、指纹和蓝牙扫码验证。

参考：[SimpleWebAuthn 服务端](https://simplewebauthn.dev/docs/packages/server)、[浏览器端](https://simplewebauthn.dev/docs/packages/browser)、[Google 跨设备通行密钥说明](https://developers.google.com/identity/passkeys/use-cases)。


### 网页二维码登录的会话边界

新增 `sys_qr_login_session` 表，部署前执行 `pnpm migration:run`（自动部署已包含此步骤）。

- 电脑创建二维码后轮询状态；手机扫码进入 `/auth/qr-confirm`，先核对两端数字，再点击验证并确认登录电脑。
- 扫描凭证位于 URL fragment，确认页读取后清除地址中的 fragment。电脑兑换凭证只保留在发起页面内存中，不会出现在二维码中。
- 手机提交的 WebAuthn challenge 必须属于该扫码会话。手机验证成功只批准会话，不向手机返回电脑的 access/refresh token。
- 仅原电脑可以一次性兑换登录结果；到期、取消、凭证被删除或密码重置改变 token 版本后不能兑换。
- 二维码有效期 5 分钟；刷新二维码或离开二维码页会取消旧会话。此登录通道与本机通行密钥登录完全分开。
- 公开接口前缀 `/api/auth/qr-login`：`sessions`、`status`、`info`、`options`、`approve`、`exchange`、`cancel`、`reject`，全部为 POST。`info/options/approve/reject` 需要扫描凭证，`status/exchange/cancel` 需要电脑凭证。
