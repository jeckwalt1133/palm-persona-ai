import type { PersonaReport } from '../../src/engine/types.js';
import type { ReportRepository } from '../../src/repository/report-repository.js';

export class MockReportRepository implements ReportRepository {
  private reports = new Map<string, PersonaReport>();

  async save(report: PersonaReport): Promise<void> {
    this.reports.set(report.id, report);
  }

  async findById(id: string): Promise<PersonaReport | null> {
    return this.reports.get(id) ?? null;
  }

  async findAll(): Promise<PersonaReport[]> {
    return Array.from(this.reports.values());
  }

  async deleteById(id: string): Promise<boolean> {
    return this.reports.delete(id);
  }
}
