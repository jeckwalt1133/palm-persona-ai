// A/B 测试管理器 — 分组分流 + 结果追踪
// 基于用户 ID 哈希分配分组，确定性保证同一用户始终在同一组

import { simpleHash } from '../../utils/hash.js';

export type TestGroup = 'A' | 'B';

export interface AbTestConfig {
  name: string;
  enabled: boolean;
  trafficA: number;  // A 组流量比例 0-100
  trafficB: number;  // B 组流量比例 0-100
}

const DEFAULT_CONFIGS: Map<string, AbTestConfig> = new Map([
  ['landing_copy', { name: 'landing_copy', enabled: true, trafficA: 50, trafficB: 50 }],
  ['report_style', { name: 'report_style', enabled: true, trafficA: 70, trafficB: 30 }],
  ['share_wording', { name: 'share_wording', enabled: false, trafficA: 50, trafficB: 50 }],
]);

const GROUP_STORE = new Map<string, TestGroup>();

export class AbTestManager {
  private configs: Map<string, AbTestConfig>;

  constructor(configs?: Map<string, AbTestConfig>) {
    this.configs = configs ?? DEFAULT_CONFIGS;
  }

  // 为用户分配测试分组（确定性哈希）
  assignGroup(userId: string, testName: string): TestGroup {
    const config = this.configs.get(testName);
    if (!config || !config.enabled) return 'A';

    const cacheKey = `${userId}:${testName}`;
    const cached = GROUP_STORE.get(cacheKey);
    if (cached) return cached;

    const hash = simpleHash(cacheKey);
    const bucket = hash % 100;
    const group: TestGroup = bucket < config.trafficA ? 'A' : 'B';

    GROUP_STORE.set(cacheKey, group);
    return group;
  }

  // 获取用户所有测试分组
  getAllGroups(userId: string): Record<string, TestGroup> {
    const result: Record<string, TestGroup> = {};
    for (const [name] of this.configs) {
      result[name] = this.assignGroup(userId, name);
    }
    return result;
  }

  // 动态更新配置
  setConfig(name: string, config: AbTestConfig): void {
    this.configs.set(name, config);
  }

  // 获取测试配置
  getConfig(name: string): AbTestConfig | undefined {
    return this.configs.get(name);
  }

  // 获取所有活跃测试
  getActiveTests(): string[] {
    return Array.from(this.configs.entries())
      .filter(([, c]) => c.enabled)
      .map(([name]) => name);
  }
}

// 单例
export const abTestManager = new AbTestManager();
