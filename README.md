# TickNote（滴答记）

一分钟循环倒计时桌面工具：边听滴答声，边给每段时间做标记，并按小时回顾你在做什么。

## 功能

- 1 分钟循环倒计时，托盘常驻
- 输入框回车：结束本轮并记入统计，开启新一轮
- 统计页：按日期 / 小时查看，文字可直接改
- 迷你模式、置顶、透明度、固定位置
- 异常退出也会尽量保留最后一段记录

## 本地运行

```bash
npm install
npm start
```

## 打包

```bash
# Windows / macOS 本地打包（不发布）
npm run dist
```

## 自动发布

推送版本标签后，GitHub Actions 会构建并发布 Windows / macOS 安装包：

```bash
git tag v1.0.0
git push origin v1.0.0
```

也可在 Actions 里手动触发 `Release` 工作流。

发布产物：

- Windows：`TickNote-*-Windows-x64.exe`（安装版 / 便携版）
- macOS：`TickNote-*-macOS-x64.dmg` / `arm64.dmg`

> macOS 当前为未公证构建。若系统拦截，可在应用上右键「打开」一次。

## 许可证

MIT
