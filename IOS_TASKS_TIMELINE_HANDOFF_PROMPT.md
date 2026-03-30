# iOS Tasks + Timeline Handoff Prompt

你现在负责把 iOS 端的 `Tasks` 和 `Timeline`/`Schedule` 功能做到与当前网页端**功能一致**，并且在移动端交互上做合理适配。这里的“功能一致”不是指视觉一模一样，而是指：

- 数据模型一致
- API 使用一致
- 任务 / 子任务 / 时间块 / 待部署区之间的行为一致
- 同样的用户操作，iOS 端要得到同样的结果

你不能自行发明另一套“相似功能”，必须围绕当前后端已经支持的真实逻辑来实现。

## Core Rule

你当前在 iOS 端**看不到网页源码**，所以不要依赖“去读网页端文件”这件事。  
下面这份文档本身就是你要遵守的行为规范。  
如果文档和你现有 iOS 端实现冲突，以这份文档为准。

换句话说：

- 你现在拿到的不是“参考意见”
- 而是“必须复刻的真实功能定义”

你需要把 iOS 端的 `Tasks` 和 `Timeline`/`Schedule` 写成与这个定义一致。

## Source of Truth Data Model

必须使用同一套概念：

- `Task`
- `SubTask`
- `TimeBlock`
- `Tag`

其中关键关系：

- 一个 `Task` 可以有多个 `SubTask`
- 一个 `Task` 可以有多个 `TimeBlock`
- 一个 `TimeBlock` 可以绑定：
  - 主任务本身
  - 或某个 `SubTask`
- `TimeBlock.subTaskId` 为可选
- `TimeBlock.isAllDay` 用来表示它是不是部署区里的 assignment
- `TimeBlock.originTimeBlockId` 为可选
  - 仅当某个部署区 assignment 是“由 timed block 自动补出来”时才会有这个值
  - 如果 assignment 是用户手动拖进部署区的，则这个值为空

你在 iOS 端必须理解这两个不同的 `TimeBlock` 角色：

### A. timed block

这是时间表里的真正时间段，例如：

- 明天 09:00 - 10:00
- 今天 14:00 - 15:30

它的特征是：

- `isAllDay = false`
- 出现在时间轴/grid里

### B. deployment assignment / 待部署区项

这是某一天下面的“待部署区 / 已部署区 / day assignment row”里的项目。

它的特征是：

- `isAllDay = true`
- 它不是具体小时块
- 它只是表示“这一天已经部署了这个主任务/子任务”

### Why originTimeBlockId matters

必须严格区分两种 assignment：

#### 手动 assignment

用户先把任务拖到某一天下面的部署区。  
这种 assignment 是用户明确放进去的。

特点：

- `isAllDay = true`
- `originTimeBlockId = null`

#### 自动 assignment

用户不是先拖到部署区，而是直接把任务拖进时间表。  
系统为了保持网页端一致行为，会自动在当天部署区补一个 assignment。

特点：

- `isAllDay = true`
- `originTimeBlockId = 某个 timed block 的 id`

这个区别决定删除逻辑：

- 如果删掉一个 timed block，而它对应的 assignment 是自动生成的，那么 assignment 也要跟着消失
- 如果 assignment 是手动创建的，那么删掉 timed block 时 assignment 不能消失

这不是“可选优化”，而是必须保持的业务规则。

这意味着 iOS 端不能把“子任务日程”做成另一套本地假结构。  
必须直接使用后端已经支持的：

- `subTaskId`
- all-day block
- timed block
- `originTimeBlockId`

## API Endpoints To Use

你必须使用现有 mobile API，不要自己拼 server actions：

### Tasks

- `GET /api/mobile/v1/tasks`
- `POST /api/mobile/v1/tasks`
- `GET /api/mobile/v1/tasks/:id`
- `PATCH /api/mobile/v1/tasks/:id`
- `DELETE /api/mobile/v1/tasks/:id`
- `POST /api/mobile/v1/tasks/:id/cycle-status`
- `POST /api/mobile/v1/tasks/:id/subtasks`
- `PATCH /api/mobile/v1/subtasks/:id`
- `DELETE /api/mobile/v1/subtasks/:id`

### Timeline / Time Blocks

- `GET /api/mobile/v1/timeline?start=...&end=...`
- `POST /api/mobile/v1/tasks/:id/time-blocks`
- `PATCH /api/mobile/v1/time-blocks/:id`
- `DELETE /api/mobile/v1/time-blocks/:id`

### Important request body requirement

创建/更新时间块时必须支持传：

- `subTaskId`
- `isAllDay`

也就是说 iOS 端在“部署对象”选择后，要把结果写进 time block，而不是只存在本地 UI 状态里。

## What The Web App Actually Does Today

## Tasks page behavior

网页端任务页的真实行为是：

### 1. 页面结构

- 顶部有视图切换：
  - `List`
  - `Week`
  - `Month`
- 状态筛选：
  - `All`
  - `Todo`
  - `Doing`
  - `Done`
- 在 `List` 视图下还有 DDL 时间筛选：
  - `All`
  - `Today`
  - `Tomorrow`
  - `This Week`
  - `This Month`

iOS 端必须保留这些筛选能力。

### 2. 在任务列表里点击任务本身

不是进入编辑页。  
真实行为是：

- 点击“主任务这一行”会展开/收起子任务区域
- 子任务区域在该任务卡片下面展开
- 有缩进，表现为它是主任务下面的内容
- 即使该任务还没有子任务，点击后也会展开出“添加子任务”的输入区

也就是说 iOS 端不要把任务点击默认变成“进详情编辑”。

### 3. 列表里的编辑按钮

网页端现在的真实要求是：

- 编辑按钮在任务行最右侧
- 是一个带边框和背景的方框按钮
- 点击这个方框才进入编辑
- 点击任务主体本身不进入编辑

iOS 端也要遵循这个职责分离：

- 主任务主体：展开/收起子任务
- 右侧编辑按钮：进入任务详情/编辑

### 4. 子任务功能

网页端现在支持：

- 在展开区域新增子任务
- 勾选子任务完成
- 删除子任务
- 子任务显示完成/未完成状态

iOS 端也必须支持同样的 CRUD，不是只读。

### 5. 右侧任务编辑面板

网页端真实逻辑：

- 默认是“查看态”
- 右上角点编辑才切换到“编辑态”
- 编辑态里编辑：
  - 标题
  - 描述
  - 状态
  - 优先级
  - dueAt
  - 标签
  - 时间块
- 普通任务编辑态里**不需要**再放子任务的新增输入区
- 子任务新增在“查看态”的子任务区域里完成

iOS 端要保持同样的分工。

## Timeline / Schedule behavior

网页端规划页最关键的真实逻辑如下：

### 1. 页面分成两个层次

- 时间表 grid
- 每天日期下方的“待部署区 / day assignment chip row”

这个“待部署区”不是装饰，是实际功能的一部分。

### 2. 拖拽来源

网页端可以从这些地方拖：

- 左侧任务池中的主任务
- 日期下方待部署区中的主任务
- 日期下方待部署区中的某个子任务

iOS 端不一定要做完全一样的拖拽手势，但最终必须支持这些业务流程。  
如果拖拽太难，至少也要支持同样的“选择目标日/时间/部署对象”的稳定替代交互。

### 3. 拖主任务到时间表

如果一个主任务有子任务：

- 从任务池直接拖到时间表
- 会先弹选择：
  - 主任务
  - 某个子任务

然后再创建 time block。

### 4. 拖部署区里的子任务到时间表

如果拖的是“部署区里已经存在的某个子任务 assignment”：

- 不再弹主任务/子任务选择
- 因为它已经是确定的子任务
- 直接沿用这个 `subTaskId`

iOS 端必须保持这个规则。

### 5. 自动同步待部署区

这是当前网页端已经要求的真实规则：

#### 规则 A

如果用户把任务**直接拖进时间表**：

- 会创建 timed block
- 同时自动在当天的待部署区补一个 all-day assignment
- 且必须记住：
  - 是主任务
  - 还是某个子任务

#### 规则 B

如果用户删除这个“自动补出来”的时间块：

- 对应自动生成的待部署区 assignment 也要自动消失

#### 规则 C

如果用户原本就是**手动先拖进待部署区**，然后再从待部署区拖进时间表：

- 删掉时间块后
- 待部署区中的那个 assignment **不能**自动消失

因为那个 assignment 不是自动补出来的，是用户手动放进去的。

iOS 端必须保持这个差异。

### 6. 点击已排进时间表的块

当前网页端要求是：

- 点击时间块本身，不是直接进入编辑表单
- 先显示任务查看态
- 并且在子任务区域上方显示：
  - `部署对象`

这里的“部署对象”允许切换：

- 主任务
- 某个子任务

切换后要真正更新后端 time block 的 `subTaskId`，不是只改显示文案。

### 7. 点击编辑按钮

对于已排时间块：

- 点击块里的编辑按钮，才进入真正的编辑表单
- 编辑表单里编辑：
  - 时间
  - 标题/状态等任务信息（如果该入口支持）
- 但不需要再重复显示“部署对象”

也就是说：

- 查看态里有“部署对象”
- 编辑态里没有“部署对象”

iOS 端要遵循这个信息分层。

## iOS Implementation Requirements

你在 iOS 端必须实现这些具体功能：

### Tasks screen

- List / Week / Month 三种视图
- Status filter
- Due filter
- 任务列表点击主行展开子任务
- 无子任务时也能展开“添加子任务”
- 右侧方框编辑按钮进入编辑详情
- 子任务：
  - create
  - toggle done
  - delete
- 任务编辑：
  - title
  - description
  - status
  - priority
  - due date
  - reminder
  - estimateMinutes
  - tags

### Timeline screen

- 周/月视图
- 显示 timed blocks
- 显示每天的待部署区
- 创建 timed block
- 创建 all-day assignment
- 主任务 / 子任务部署对象选择
- 从 assignment 再进入 timed block 时保留部署对象
- 删除 timed block 时处理“自动 assignment 是否要联动删除”
- 点击块时先看查看态，并且有部署对象切换

## Mobile-specific design guidance

网页端是桌面优先布局，iOS 端不能机械照搬，但行为必须等价。

### Tasks on iPhone

建议：

- 使用原生 `List`
- 每个任务 cell 自带：
  - 左侧状态切换按钮
  - 中间标题/元信息
  - 右侧编辑方框按钮
- 点击 cell 主体展开内嵌子任务区域
- 使用流畅的高度动画，而不是硬切

展开动画要求：

- 用自然的 `easeInOut` 或 spring
- 展开区域高度变化不能突兀
- 展开后输入框要稳定，不要跳 layout

### Timeline on iPhone

建议：

- 周视图优先
- 月视图可用较轻量版本
- 任务池 / 待部署区 / 时间表三者不一定要和桌面横向并排
- 但必须保持业务动作等价

如果纯拖拽在 iPhone 上太重，可以采用：

- 长按任务 -> 弹出“部署到哪一天/时间”
- 或拖到某日后再用 sheet 选择具体时间和部署对象

但一定要保留：

- 主任务 vs 子任务选择
- 自动 assignment 同步
- 删除 block 时 assignment 联动规则

## Animation guidance

动画必须流畅、自然，不要机械。

建议场景：

- 任务展开/收起子任务：
  - spring / smooth height transition
- 时间块创建：
  - 轻微淡入 + scale from 0.98
- 查看态 <-> 编辑态：
  - slide/fade
- 部署对象切换：
  - segmented control 或 list row selection 的平滑高亮变化

不要出现：

- 点击后整个页面闪一下
- 子任务区域一帧跳开
- 列表重排闪烁

## API usage details

### Create subtask

- `POST /api/mobile/v1/tasks/:id/subtasks`

### Toggle / update subtask

- `PATCH /api/mobile/v1/subtasks/:id`

Body should support at least:

- `done`
- `title`

### Delete subtask

- `DELETE /api/mobile/v1/subtasks/:id`

### Create timed block

- `POST /api/mobile/v1/tasks/:id/time-blocks`

Body must support:

- `startAt`
- `endAt`
- `isAllDay`
- `subTaskId`

### Update timed block

- `PATCH /api/mobile/v1/time-blocks/:id`

Body must support:

- `startAt`
- `endAt`
- `subTaskId`
- `isAllDay`

## Critical correctness rules

These are non-negotiable:

- 不要在 iOS 端自己伪造一套“子任务部署状态”
- 不要把主任务和子任务 schedule 分开成两套模型
- 不要只更新本地 UI 而不写回 API
- 不要丢掉 `subTaskId`
- 不要让删除 timed block 时无条件删除所有 assignment
- 必须区分：
  - 手动 assignment
  - 自动补出来的 assignment

## Acceptance checklist

你交付前必须逐项自查：

1. 点击任务主行是否展开/收起子任务
2. 即使没有子任务，展开后是否能添加子任务
3. 右侧编辑按钮是否独立，不和主点击冲突
4. 子任务能否增删改勾选
5. 拖主任务到时间表时，是否能选择主任务/子任务
6. 拖“部署区里的子任务”到时间表时，是否不再二次弹选择
7. 直接拖到时间表时，是否自动补待部署区 assignment
8. 删除自动生成的 timed block 时，自动 assignment 是否一起消失
9. 删除“从手动 deployment 派生”的 timed block 时，手动 assignment 是否保留
10. 点击已排块时，是否先进入查看态
11. 查看态里是否有部署对象
12. 部署对象切换是否真的更新后端
13. 编辑态里是否不再重复显示部署对象

## Your task

请直接修改 iOS 端代码，让 `Tasks` 和 `Timeline` 页面在功能上与上述网页端逻辑保持一致。

完成后请明确说明：

- 改了哪些 Swift 文件
- 哪些交互现在与网页端保持一致
- 哪些地方为了 iPhone 做了交互适配
- 是否还有未实现差异
