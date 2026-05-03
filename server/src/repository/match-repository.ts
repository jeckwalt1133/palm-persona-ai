import { MatchInvite } from '../engine/types.js';

export interface MatchRepository {
  save(invite: MatchInvite): Promise<void>;
  findById(id: string): Promise<MatchInvite | null>;
  deleteById(id: string): Promise<boolean>;
  // 清理过期匹配
  cleanExpired(): Promise<number>;
}

export class InMemoryMatchRepository implements MatchRepository {
  private matches = new Map<string, MatchInvite>();

  async save(invite: MatchInvite): Promise<void> {
    this.matches.set(invite.id, invite);
  }

  async findById(id: string): Promise<MatchInvite | null> {
    return this.matches.get(id) ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    return this.matches.delete(id);
  }

  async cleanExpired(): Promise<number> {
    const now = new Date().toISOString();
    let cleaned = 0;
    for (const [id, invite] of this.matches) {
      if (invite.expiresAt < now) {
        this.matches.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
