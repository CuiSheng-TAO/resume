# Inline Brand Lockup Design

## Goal

把首页 hero 从“左边品牌名、右边 slogan”的对峙结构，收成一个更统一的品牌锁定：`Siamese Dream` 为唯一主标题，`人人都有美观简历` 作为贴近标题的微型副标。

## Why

- 当前 hero 有左右对峙感，视觉重心被拆开。
- `人人都有美观简历` 更像品牌宣言，不适合再做一个远离标题的次主角。
- 审美参考更接近“主标题强、辅助信息小、层级克制”的锁定方式。

## Chosen Direction

- 顶部只保留一个品牌区，不再单独保留右侧 slogan 区。
- `Siamese Dream` 继续作为大标题。
- `人人都有美观简历` 作为与主标题同排的小副标，颜色更淡、字重更轻，并用轻分隔处理。
- `3 分钟先起一版，接着用 3 步把它修成可投递简历。` 下沉为主标题下方的辅助说明，不再占据右栏。

## Implementation Notes

- 组件层：把 hero 结构改成 `hero-brand -> hero-title-lockup + hero-note`。
- 样式层：新增 inline lockup 样式，删除右侧 slogan 区的布局依赖。
- 测试层：更新首页断言，确保不再渲染旧的 `.hero-side` 结构。
