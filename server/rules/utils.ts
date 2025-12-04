import type { BureauReport, CreditReport, Tradeline } from '../models/creditReport';
import type { IssueFlag, IssueSeverity, StatuteRef } from '../models/issues';

let issueCounter = 0;

export function nextIssueId(): string {
  issueCounter += 1;
  return `ISSUE_${issueCounter.toString().padStart(5, '0')}`;
}

export interface TradelineClusterItem {
  bureau: BureauReport['bureau'];
  tradeline: Tradeline;
}

export interface TradelineCluster {
  clusterKey: string;
  items: TradelineClusterItem[];
}

export function clusterTradelinesByCreditorAndAccount(report: CreditReport): TradelineCluster[] {
  const map = new Map<string, TradelineCluster>();

  for (const bureauReport of report.bureaus) {
    for (const tl of bureauReport.tradelines) {
      const key = [
        normalizeString(tl.creditorName),
        normalizeString(tl.accountNumberMasked ?? ''),
        (tl.openedDate ?? '').slice(0, 7),
      ].join('|');

      if (!map.has(key)) {
        map.set(key, { clusterKey: key, items: [] });
      }
      map.get(key)!.items.push({ bureau: bureauReport.bureau, tradeline: tl });
    }
  }

  return Array.from(map.values());
}

function normalizeString(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createIssueFlag(params: {
  ruleId: string;
  family: string;
  category: string;
  severity: IssueSeverity;
  statutes: StatuteRef[];
  affectedEntityType: IssueFlag['affectedEntityType'];
  affectedBureaus?: IssueFlag['affectedBureaus'];
  affectedIds: string[];
  descriptionMachine: string;
  explanationKey: string;
  details?: Record<string, unknown>;
}): IssueFlag {
  return {
    id: nextIssueId(),
    ruleId: params.ruleId,
    family: params.family,
    category: params.category,
    severity: params.severity,
    affectedEntityType: params.affectedEntityType,
    affectedBureaus: params.affectedBureaus,
    affectedIds: params.affectedIds,
    statutes: params.statutes,
    descriptionMachine: params.descriptionMachine,
    explanationKey: params.explanationKey,
    details: params.details ?? {},
  };
}

export function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function yearsBetween(start?: string, end?: string): number | undefined {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e) return undefined;
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return (e.getTime() - s.getTime()) / msPerYear;
}

export function daysBetween(start?: string, end?: string): number | undefined {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e) return undefined;
  const msPerDay = 1000 * 60 * 60 * 24;
  return (e.getTime() - s.getTime()) / msPerDay;
}

export function todayIso(): string {
  return new Date().toISOString().substring(0, 10);
}

export function monthsBetween(start?: string, end?: string): number | undefined {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e) return undefined;
  const years = e.getFullYear() - s.getFullYear();
  const months = e.getMonth() - s.getMonth();
  return years * 12 + months;
}
