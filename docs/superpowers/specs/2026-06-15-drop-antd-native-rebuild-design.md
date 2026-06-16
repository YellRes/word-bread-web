# 去 Ant Design，原生重建 UI — 设计文档

> 日期：2026-06-15
> 项目：word-bread-web（React 19 + Vite + Supabase 的双语句子学习库内部工具）

## 目标与动机

完全移除 Ant Design，改用**原生 React + 手写 CSS** 重建整套 UI，换取对外观的完全掌控（动机：设计掌控，非纯减体积）。行为/无障碍逻辑用 **Radix UI 无头组件**承担，样式 100% 由自己用现有 `--wb-*` token 体系手写。

**保持不变**：所有 service（`articleService`/`sentenceService`）、`types`、txt 解析逻辑、全部功能与中文文案、信息架构（文章 → 可展开句子）。

## 已定决策

1. 动机 = 完全设计掌控，用原生 CSS。
2. 行为类组件 = Radix UI 无头 + 自写全部 CSS（不重造焦点陷阱等轮子）。
3. CSS = 手写，延续 [src/index.css](../../../src/index.css) 已有的 `--wb-*` token 系统，不引入 Tailwind/CSS-in-JS。
4. 可搜索文章选择器 = **Radix Popover + 自写过滤输入**（留在 Radix 生态、零额外依赖）。

## 组件映射

| 当前 antd | 替代方案 | 备注 |
|---|---|---|
| `ConfigProvider`/`theme`/`App`/`locale` | 删除 | 主题已在 index.css token |
| `Button` | 原生 `<button>` + `.wb-btn`（变体：primary / default / link / danger / size-small） | |
| `Space` | flex + gap（CSS） | |
| `Table`（文章，可展开 + loading） | 原生 `<table>` + 复用 `expandedRowKeys` 状态 + 骨架 loading | 去掉分页 |
| `Table`（嵌套句子） | 原生 `<table>` | |
| `Form` + `Form.Item` + 校验 | 原生受控表单 + 手写校验；label 在上、错误在下 | |
| `Input` / `Input.TextArea` | 原生 `<input>` / `<textarea>` + `.wb-input` | |
| `Select`（可搜索） | `ui/Combobox`：Radix Popover + 过滤输入 + 列表 | 见下 |
| `Modal` | `ui/Modal`：`@radix-ui/react-dialog` | 焦点陷阱/Esc/遮罩由 Radix |
| `Popconfirm` | `ui/ConfirmButton`：`@radix-ui/react-alert-dialog` | |
| `Upload.Dragger` | `ui/FileDropzone`：原生拖拽 + 隐藏 `<input type=file>` + 现有 `FileReader` | 解析逻辑零改动 |
| `Alert` | `.wb-alert`（原生 div） | |
| `message` | `ui/toast`：`@radix-ui/react-toast` + `useToast()` 封装 | 替换全部 `message.success/error` |
| `Tag` | `.wb-chip`（已原生） | 已完成 |
| 图标 Book/Plus/Upload/Inbox | `@phosphor-icons/react`（BookOpen / Plus / UploadSimple / Tray） | strokeWidth 全局统一 |

## 依赖变更

- 移除：`antd`、`@ant-design/icons`
- 新增：`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-toast`、`@phosphor-icons/react`

## 新增文件结构

```
src/components/ui/
  Button.tsx          # 原生按钮 + 变体
  Modal.tsx           # Radix Dialog 封装
  ConfirmButton.tsx   # Radix AlertDialog 封装（删除确认）
  Combobox.tsx        # Radix Popover + 过滤（可搜索选择器）
  FileDropzone.tsx    # 拖拽上传
  Field.tsx           # 表单字段：label + 控件 + 错误文案
  toast.tsx           # ToastProvider + useToast
  Spinner.tsx / Skeleton.tsx  # loading
```

`index.css` 扩展：`.wb-btn`、`.wb-input`、`.wb-table`、`.wb-modal`、`.wb-popover`、`.wb-alert`、`.wb-field` 等类，全部基于现有 `--wb-*` token。

## 各单元职责（接口边界）

- **Button**：受控 props `variant/size/icon/loading/onClick`；无内部状态。
- **Modal**：受控 `open/onOpenChange/title/footer/children`；行为来自 Radix Dialog。
- **ConfirmButton**：`title/onConfirm/okText/cancelText` + 触发器 children；点击触发 AlertDialog。
- **Combobox**：`value/onChange/options[{label,value}]/placeholder/disabled`；内部仅持有"搜索输入框文本"和"开合"两个本地状态。
- **FileDropzone**：`accept/onFile(file)`；不持有业务状态。
- **Field**：`label/required/error/extra` + children 控件。
- **useToast**：`toast.success(msg)` / `toast.error(msg)`；Provider 在 main.tsx 根部。

## 校验策略（替代 antd Form rules）

- 句子表单：`articleId` 必填、`content` 必填、`translate` 选填。
- 文章表单：`title` 必填。
- 提交时校验，错误就近显示在字段下方；失败不关闭弹窗。

## Loading / Empty / Error 状态（技能要求）

- 文章列表加载：骨架行。
- 展开句子加载：行内 spinner。
- 空列表：友好空状态（提示"新建文章/句子"）。
- 上传解析失败：`.wb-alert` 行内错误。

## 主题锁定（沿用）

亮色锁定、单一琥珀强调色 `#b45309`、圆角 8px、暖中性。按钮主色白字对比度 ~5:1 过 WCAG AA。

## 非目标（YAGNI）

- 不做暗色模式（后续可加）。
- 不做分页（数据小，可滚动）。
- 不做拖拽排序、不做多选、不做虚拟滚动。
- 不引入路由（单页）。

## 验收

- `npx tsc -b --noEmit` 零错误；`npm run build` 成功。
- 桌面 + 移动端截图验证：header、工具栏、表格、展开、三个弹窗、toast、删除确认、文件上传、可搜索选择器均可用。
- bundle 体积较 antd 版本显著下降。
- `grep -r "antd\|@ant-design"` 在 src/ 下零命中。
