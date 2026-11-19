# TickNote Mobile（Expo）

独立移动端目录：`mobile/`。当前是 **最小可用版**（登录 / 一分钟循环记一条 / 同步到 Timeline）。

默认同步服务器：`https://timeline.wangyang.wiki`  
与桌面端、网站共用同一套账号与 `/api/sync/*`。

技术栈：**React Native + Expo**（方便以后一套代码打 iOS / Android）。

---

## 你只有 iPhone 时怎么装（推荐）

不需要先买 Apple 开发者账号，也不需要 Mac 才能「看见」App。开发阶段用 **Expo Go**。

### 1. 手机准备

1. 打开 App Store，搜索并安装 **Expo Go**。
2. iPhone 与电脑尽量连同一 Wi‑Fi（不行也没关系，用下面的 tunnel）。

### 2. 电脑准备

需要 Node.js 18+（建议 20/22）。在仓库根目录：

```bash
cd mobile
npm install
npm start
```

终端里会出现二维码。也可以强制走公网隧道（跨网更稳）：

```bash
cd mobile
npx expo start --tunnel
```

首次使用 tunnel 可能会提示安装 `@expo/ngrok`，按提示安装即可。

### 3. 在 iPhone 上打开

**同一 Wi‑Fi：**

1. 打开系统自带「相机」，扫终端里的二维码。
2. 点横幅 / 提示，用 **Expo Go** 打开项目。

**不同网络 / 扫码失败：**

1. 用 `npx expo start --tunnel`。
2. 打开 Expo Go → 输入终端显示的连接地址，或再扫一次二维码。

### 4. 登录

- 用户名 / 密码：与网站或桌面同步账号相同（例如 `admin`）。
- 服务器地址默认已是 `https://timeline.wangyang.wiki`，一般不用改。

### 5. 日常使用

1. 倒计时跑一分钟循环。
2. 写备注，点「记一条并重开」（或键盘完成）。
3. 点「同步」推到云端；网站控制台 / 桌面端也能看到。

---

## 常见问题（iOS）

| 现象 | 处理 |
|------|------|
| 扫码没反应 | 确认装的是 Expo Go；改用 `--tunnel` |
| Expo Go 报 SDK 不匹配 | 更新 Expo Go，或让电脑侧 `expo` 与手机 App 大版本一致 |
| 只能用 7 天？ | 那是「自己编译安装到手机」的免费证书限制。**Expo Go 开发预览没有这个 7 天限制** |
| 想上架 App Store | 需要 [Apple Developer](https://developer.apple.com/)（年费），再用 EAS Build 出 IPA |

---

## 以后正式安装包（可选，需开发者账号）

```bash
cd mobile
npx eas-cli login
npx eas build -p ios
```

没有账号时，继续用 Expo Go 即可开发和自用。

---

## Android（同一套代码）

有安卓机时：

```bash
cd mobile
npm start
```

用 Expo Go（Google Play）扫码即可。以后打包：

```bash
npx eas build -p android
```

---

## 本机脚本

```bash
npm start          # 开发服务 + 二维码
npm run ios        # 仅在 macOS + 模拟器时有用
npm run android    # 安卓模拟器 / 设备
npm run web        # 浏览器调试（能力有限）
```

---

## 目录说明

```
mobile/
  App.tsx                 # 入口：登录态切换
  src/api.ts              # Timeline API
  src/storage.ts          # 本地会话 + 安全存储 token
  src/session.ts          # 会话合并 / 时长格式化
  src/screens/LoginScreen.tsx
  src/screens/HomeScreen.tsx
  README.md               # 本说明
```

当前**不做**：桌面置顶小窗、系统托盘、截图、复杂统计页。这些移动端能力不同，后续再加。
