---
name: "海岸 · 潮汐之间"
description: "实时海岸、夏威夷木屋与停留在画面边缘的中文观看控件"
colors:
  coast: "#163c46"
  surface: "#102e37ed"
  panel: "#102e37f5"
  ink: "#f2f7f4"
  muted: "#c0d6d8"
  accent: "#b8eee1"
  selected-ink: "#153c43"
  hover: "#28464e"
  control: "#193d46"
typography:
  brand-title:
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: ".12em"
  title:
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "17px"
    fontWeight: 500
  body:
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "11px"
    lineHeight: 1.9
  label:
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
  view-label:
    fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "13px"
rounded:
  control: "6px"
  group: "10px"
  panel: "12px"
spacing:
  gutter: "clamp(20px, 3vw, 48px)"
  group: "4px"
  icon-gap: "8px"
  panel: "20px 24px"
  panel-mobile: "18px 22px"
components:
  button-tool:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  button-view:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-view-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-close:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "44px"
  settings-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px 24px"
    width: "304px"
  range:
    height: "44px"
    width: "100%"
  select:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    rounded: "5px"
    padding: "0 25px 0 12px"
---

# Design System: 海岸 · 潮汐之间

## Overview

**Creative North Star: "潮汐之间"**

用实时海面、泡沫、湿沙和天空构成完整观看空间，沿岸木屋与露台带入夏威夷家庭生活的尺度。界面只在画面边缘提供必要操作，以深青底、清浅文字和薄荷色选中态保证水面与天空变化时仍可辨认。

这是用户指定 Tidewater 海岸参考后的设计记录，保留现有界面并加入已展示的木屋概念。视觉依据为 `index.html`、`src/coast.css`、海岸渲染器与 `artifacts/coast/concepts/hawaii-house-v1.png`。房屋以蓝绿木板、奶油色边框、珊瑚红坡屋顶和自然木露台构成明确轮廓。海水、沙面、房屋和天空的颜色随光照计算，不能将某一帧的渲染颜色固定成通用界面 token。

木屋目前已通过 CPU 几何检查与生产构建，新增场景的浏览器渲染及桌面、手机视口尚未验证。此前海滩截图只证明原有海岸画面，不含本次房屋。

**Key Characteristics:**

- 海岸占满视口，操作层沿四角分布。
- 架高木屋与露台在岸线上保留生活尺度，开放海面保持可见。
- 深青操作面承载浅色文字，薄荷色表达选中与焦点。
- 紧凑中文标签、原生表单和细线 SVG 图标。
- 海浪连续运动，界面仅保留短促状态过渡。

## Colors

界面使用与海岸协调的深青和浅薄荷色；前置 token 提取自当前 CSS，保持原始透明度。

### Primary

- **潮沫薄荷 / accent**：当前视角、滑块、数值读数、进度条和键盘焦点。

### Neutral

- **海岸深青 / coast**：页面及加载阶段底色。
- **工具深青 / surface、面板深青 / panel**：工具组与设置面板的半透明衬底。
- **潮白 / ink、雾青 / muted**：主要文字与辅助提示。
- **选中深青 / selected-ink**：薄荷色按钮上的深色文字。
- **悬停青 / hover、表单青 / control**：交互状态与原生选择框。

**The Readable Overlay Rule.** 在动态海面上以深色操作面保证文字对比，不依赖场景某一时刻恰好够暗。

## Typography

操作层使用系统中文无衬线字体。前置 token 记录品牌小标题、面板标题、说明、工具标签和视角标签的实际字级；没有占据海岸的大型展示标题，也没有新加载的字体文件。

品牌标题在手机宽度下降为 18px，并隐藏“潮汐之间”副标。加载标题为 24px，错误标题为 22px，均使用 500 字重。数值读数使用等宽数字特性，主控件通过点击区域维持可操作性。

## Layout

场景固定填满浏览器，页面不滚动。左上为小型标识，右上为暂停及设置；左下为岸边、木屋、俯瞰、水线四个视角，右下为操作提示。水平边距采用 gutter token，顶底间距兼顾安全区。设置为靠右的 304px 浮层，内部独立滚动。

宽度不超过 600px 时，工具按钮隐藏文字并保持 44px 高度；底部改为纵向排列，提示在视角组下方。设置面板限制在视口宽度减 40px 内，并限制高度；高度不超过 560px 时采用单独的矮屏规则。触摸提示由粗指针媒体查询切换。

**The Scene First Rule.** 操作围绕画面边缘组织，展开的设置面板不替换实时场景。

## Elevation & Depth

自然空间的深度来自地形、海面、光照、折射与空气透视。木屋采用真实场景网格，露台与阶梯应有可读厚度，屋顶檐口、支柱与道具投影表达结构；概念图不作为背景替代房屋。界面以半透明深青面和轻柔阴影与场景分层；设置浮层使用 `0 12px 32px #08232b36`，错误面板使用 `0 16px 50px #08232b6b`。品牌和操作提示使用轻量文字阴影，没有背景模糊滤镜。

海浪运动属于场景模拟。工具与视角按钮仅用 180ms 的颜色过渡，加载层以 400ms 淡出；减少动态偏好关闭这些过渡，并在场景就绪时默认暂停海浪。暂停仍保留镜头与光照交互。

## Shapes

按钮和提示使用小圆角，工具组略大，浮层最大；具体层级由 rounded token 表达。图标由圆端细线 SVG 组成，通常为 19px；海浪标记沿用两道波形。原生滑块保留浏览器形态，以强调色统一。

## Components

### Toolbar and View Buttons

工具按钮在深青组内保持透明，悬停出现青色衬底。视角组以薄荷色实底和加重文字表示当前选择，通过 `aria-pressed` 同步状态。暂停按钮同时改变图标、标签和按下状态。加载完成前禁用主要场景控件。

### Beach House

双层蓝绿木板房、奶油色门窗边框、珊瑚红坡屋顶与木露台遵循概念图的材质关系。房屋架高于干沙，宽台阶连接露台与活动区域，吊床、座椅、冲浪板与盆栽围绕入口布置。细节通过网格与材质表现，保持远景轮廓清楚，近景可辨认结构。

### Settings Panel

面板内按时间、浪势、亮度、画面精度、恢复和操作说明排列。滑块均关联文字标签与读数，选择框为原生控件。关闭按钮为 44px 方形，打开后获得焦点；关闭或按 Escape 后返回设置按钮。

### Loading and Error States

加载层使用海岸底色、波形标记、阶段说明和细进度条。首次编译提示保留在进度下方；进度值表达阶段完成情况。错误面板包含可换行的说明与浅色重新加载按钮。

### Focus and Touch

界面控件使用 2px 薄荷色轮廓与 4px 向外偏移作为键盘焦点；全屏画布使用同色同宽轮廓及 -3px 内缩，保持焦点线在视口内可见。按钮、滑块及选择框的主要操作高度至少 44px。手机可隐藏工具文字，但保留可访问名称。

## Do's and Don'ts

### Do:

- **Do** 保持动态海岸为主要观看区域，控件集中在边缘。
- **Do** 以薄荷色明确表达选中、数值与键盘焦点。
- **Do** 保留原生表单语义、焦点可见性与移动端点击区域。
- **Do** 用真实初始化阶段说明着色器编译等待。

### Don't:

- **Don't** 将旧展览的黑金色、宋体大标题或章节时间线带回当前首页。
- **Don't** 把场景截图、设计参考或旧视频当作实时渲染的替代品。
- **Don't** 为增加装饰遮住破碎浪、湿沙和近岸水线。
