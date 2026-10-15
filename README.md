# 青简 · 中文校招简历工作台

基于 [Reactive Resume](https://github.com/reactive-resume/reactive-resume) 源码与历史新增的中文校招扩展。保留上游 MIT 许可与作者说明，在 `examples/campus-cn/` 中提供可独立运行的浏览器应用。

[在线使用青简](https://weizhegu999-ui.github.io/campus-resume-cn/) · [中文扩展源码](examples/campus-cn/)

## 新增能力

- 三套中文 A4 模板、实时预览、字号与行距调整，以及长内容分页提示。
- STAR 结构项目编辑，按已有事实整理描述，不自动生成指标或虚构结果。
- 本地 JD 词典匹配，解释已覆盖和缺失术语；分数不代表录用概率。
- 校招草稿 JSON、Reactive Resume v6 字段子集交换、本地自动保存。
- 浏览器打印保存 PDF；AI 协作提示词只生成文本，不连接外部模型。

## 立即运行

需要 Node.js 24。零运行依赖，无需启动上游数据库或安装整个 monorepo。

```sh
node examples/campus-cn/scripts/serve.mjs
```

打开终端显示的地址，默认 `http://127.0.0.1:4174`。Windows 可双击 `examples/campus-cn/启动.cmd`。

```sh
node --test examples/campus-cn/tests/*.test.js
```

本地 26 项测试通过，默认虚构简历 PDF 已检查为一页。详见 [扩展说明](examples/campus-cn/README.md)、[验证记录](examples/campus-cn/docs/verification.md) 与 [面试准备指南](examples/campus-cn/docs/project-guide.md)。

## 复用了什么

上游基线：`19e0518eb5ea1b2c84d785bc5ea2b6d6c9d7b043`。

实际复用上游默认数据和分区过滤规则，并保留可核对摘要的快照与生成脚本。编辑界面、中文 HTML 模板、草稿适配和岗位匹配为本扩展新增实现。完整上游服务端、账号系统和 Forme PDF 渲染器没有在本示例中运行。

[第三方来源与许可证](examples/campus-cn/THIRD_PARTY_NOTICES.md) · [上游原始 README](README.upstream.md) · [MIT License](LICENSE)

## 静态部署

本示例可发布到 GitHub Pages。工作流 `.github/workflows/campus-pages.yml` 先执行本示例测试，再只复制静态运行资源；它仅在手动触发时发布。仓库 Settings → Pages 选择 GitHub Actions，运行 Campus Resume Pages 即可。

公开代码仅包含虚构演示数据，不包含个人简历。填写的简历保存在访问者自己的浏览器中，应用不会自动上传。
