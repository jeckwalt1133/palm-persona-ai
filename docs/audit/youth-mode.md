# 青少年模式实现说明

## 模式入口
- 首页底部左侧固定"青少年模式"开关
- 首次进入弹窗询问"是否开启青少年模式"
- 设置页提供开关入口

## 开启后限制

| 功能 | 青少年模式 | 普通模式 |
|------|-----------|---------|
| 每日分析次数 | 1 次 | 3 次 + 激励视频解锁 |
| 关系匹配 | 隐藏入口 | 可用 |
| 分享功能 | 禁用 | 可用 |
| 历史报告 | 仅查看 | 完整功能 |
| 数据删除 | 可删除 | 可删除 |

## 技术实现

### 前端（Taro/React）
```tsx
// stores/app.ts — 全局状态
interface AppState {
  youthMode: boolean;
  dailyAnalysisCount: number;
}

// pages/index/index.tsx
function IndexPage() {
  const [youthMode, setYouthMode] = useState(false);
  
  // 首页固定显示青少年模式开关
  {!youthMode && (
    <View className="youth-mode-switch" onClick={toggleYouthMode}>
      <Text>开启青少年模式</Text>
    </View>
  )}
}
```

### 后端校验
```ts
// middleware/youth-mode.ts
async function enforceYouthMode(req: FastifyRequest, reply: FastifyReply) {
  if (req.headers['x-youth-mode'] === 'true') {
    const analysisCount = await getDailyAnalysisCount(req.userId);
    if (analysisCount >= 1) {
      return reply.status(429).send({
        error: { code: 'YOUTH_MODE_LIMIT', message: '青少年模式下每日仅可分析 1 次' },
      });
    }
  }
}
```

## 合规说明
- 青少年模式符合《未成年人保护法》第 76 条要求
- 不收集未成年人个人信息
- 不展示个性化广告
- 不提供付费功能

## 审核注意事项
- 首页青少年模式开关需在首屏可见
- 开启后不可由用户自行关闭（需验证身份）
- 退出青少年模式需家长确认（验证码/密码）
