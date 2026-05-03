# API 文档（终版）

## 基础
- Base URL: http://localhost:3001
- Content-Type: application/json
- 请求头：X-User-Id（设备 ID，所有请求必须携带）
- CORS：已开启（@fastify/cors）
- bodyLimit: 10MB
- 限流：同设备 ID 每分钟最多 3 次 /api/analyze

## 错误响应格式
```json
{ "error": "错误描述", "code": 400, "details": {} }
```
特殊错误码：`NON_PALM_IMAGE`(400)、`RATE_LIMITED`(429)、`INVITE_EXPIRED`(410)

## 接口
| 方法 | 路径 | 说明 | 新增/变更 |
|------|------|------|-----------|
| POST | /api/analyze | 上传手掌图片+辅助标点，生成人格报告 | 新增 palmPoints、NON_PALM_IMAGE、限流 |
| GET | /api/reports?userId=xxx | 历史报告列表 | |
| GET | /api/reports/:id | 查询报告详情 | |
| DELETE | /api/reports/:id | 删除报告 | |
| POST | /api/reports/:id/feedback | 提交反馈(1-4星) | |
| GET | /api/daily-keyword | 每日关键词 | |
| POST | /api/match/create | 创建匹配邀请 | 新增 expiresAt(7天) |
| POST | /api/match/:id/join | 好友加入匹配(可附带报告) | 新增过期校验 |
| GET | /api/match/:id | 匹配状态(含是否过期) | |
| GET | /api/match/:id/result | 匹配结果(含特征对比) | |

## POST /api/analyze 请求体
```json
{
  "imageBase64": "...",
  "context": { "focusArea": "love", "selfPerception": "慢热但靠谱", "relationshipPainPoint": "沟通没有回应" },
  "palmPoints": { "lifeLineStart": [x,y], "headLineStart": [x,y], "heartLineStart": [x,y], "indexBase": [x,y], "pinkyBase": [x,y], "wristCenter": [x,y], "thumbTip": [x,y], "middleTip": [x,y] }
}
```
- imageBase64：前端压缩至 5MB 以内
- palmPoints：用户辅助标点坐标，缺失时 hash fallback
- 返回 400 NON_PALM_IMAGE：confidence < 0.3

## POST /api/match/create 请求体
```json
{ "creatorReportId": "r1", "relationshipType": "friend" }
```
响应含 `expireTime`（创建后+7天）

## POST /api/match/:id/join
- 校验邀请是否过期 → 410 INVITE_EXPIRED
- 可不带 reportId，由服务端临时生成好友报告

## 核心数据结构
详见 server/src/types/report.ts、match.ts、api.ts、analysis.ts

## Mock 模式
设置 AI_PROVIDER=mock，无需 API Key。MockAIProvider 直接使用引擎生成的骨架文案，不调 LLM。
