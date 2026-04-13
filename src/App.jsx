import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Building2,
  Layers3,
  Globe2,
  Bookmark,
  Search,
  ArrowUpRight,
  Radio,
  Newspaper,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Clock3,
  Link2,
  TrendingUp,
  Database,
  RefreshCcw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const DATA_URLS = {
  groupedAlerts: "/data/signal-terminal/grouped_alerts.json",
  watching: "/data/signal-terminal/single_company_watch.json",
  multiCompany: "/data/signal-terminal/multi_company_links.json",
  macroCards: "/data/signal-terminal/macro_cards.json",
};

const fallbackBundle = {
  groupedAlerts: [
    {
      group_key: "TSLA|fsd approval",
      primary_ticker: "TSLA",
      display_title: "Dutch Regulators Approve Tesla’s Full Self-Driving Software",
      summary_line:
        "네덜란드 규제 승인으로 Tesla FSD의 유럽 확장 신호가 확인됐다. 같은 사건은 한 건으로 묶고 출처는 모두 노출한다.",
      primary_source: "Bloomberg Industries RSS",
      primary_source_url: "https://www.bloomberg.com/",
      also_covered_by: ["Electrek RSS", "Teslarati RSS"],
      also_covered_by_sources: [
        { name: "Electrek RSS", url: "https://electrek.co/" },
        { name: "Teslarati RSS", url: "https://www.teslarati.com/" },
      ],
      source_count: 3,
      all_sources: [
        { name: "Bloomberg Industries RSS", url: "https://www.bloomberg.com/", is_primary: true },
        { name: "Electrek RSS", url: "https://electrek.co/", is_primary: false },
        { name: "Teslarati RSS", url: "https://www.teslarati.com/", is_primary: false },
      ],
      member_count: 3,
      updated_at: "11:28",
      event_type: "Regulatory approval",
      theme: "Autonomous Driving",
    },
    {
      group_key: "MSFT|deal pause",
      primary_ticker: "MSFT",
      display_title: "Microsoft Staff Tell Carbon Removal Projects That Deals Paused",
      summary_line:
        "Microsoft의 탄소제거 계약 중단은 관련 프로젝트와 carbon removal 시장 심리에 직접적인 시그널이다.",
      primary_source: "Bloomberg Green RSS",
      primary_source_url: "https://www.bloomberg.com/green",
      also_covered_by: [],
      also_covered_by_sources: [],
      source_count: 1,
      all_sources: [{ name: "Bloomberg Green RSS", url: "https://www.bloomberg.com/green", is_primary: true }],
      member_count: 1,
      updated_at: "10:51",
      event_type: "Commercial pause",
      theme: "Climate / Carbon",
    },
  ],
  watching: [
    {
      title: "Rio Is Said to Draw Interest for Critical Mineral Assets in California",
      unique_tickers: ["RIO"],
      site_name: "Bloomberg Industries RSS",
      ops_score: 6,
      ops_reasons: ["trusted_source", "single_ticker", "title_ticker_aligned", "rumor_like_title"],
      why_watch: "rumor 성격이 있어 alert가 아니라 watch로 유지",
      source_url: "https://www.bloomberg.com/",
    },
    {
      title: "Former OpenAI Stargate Leaders Plan to Join Meta Platforms",
      unique_tickers: ["META"],
      site_name: "Bloomberg Business RSS",
      ops_score: 6,
      ops_reasons: ["trusted_source", "single_ticker", "title_ticker_aligned", "rumor_like_title"],
      why_watch: "인재 이동은 의미 있지만 강한 hard-news 이벤트보다는 한 단계 아래",
      source_url: "https://www.bloomberg.com/",
    },
    {
      title: "Nvidia opinion-heavy coverage cluster",
      unique_tickers: ["NVDA"],
      site_name: "The Motley Fool Feed",
      ops_score: 3,
      ops_reasons: ["watch_source", "single_ticker", "title_ticker_aligned", "opinion_like_title"],
      why_watch: "source trust와 opinion 패턴 때문에 alert 승격 금지",
      source_url: "https://www.fool.com/",
    },
  ],
  multiCompany: [
    {
      title: "AI infra cluster stories",
      unique_tickers: ["INTC", "NVDA", "TSLA", "GOOGL"],
      lane_reason: "3plus_tickers",
      site_name: "Bloomberg Technology RSS",
      summary: "다수 회사가 함께 묶이는 AI infra / capex 흐름",
      source_url: "https://www.bloomberg.com/technology",
      source_count: 6,
    },
    {
      title: "Sector movers and basket articles",
      unique_tickers: ["AAPL", "AMZN", "JPM", "MSFT", "NVDA"],
      lane_reason: "basket_title_pattern",
      site_name: "Seeking Alpha Market Currents RSS",
      summary: "단일 기업 alert가 아니라 digest로 소비해야 하는 multi-company 기사 묶음",
      source_url: "https://seekingalpha.com/market-news",
      source_count: 8,
    },
  ],
  macroCards: [
    {
      title: "Energy and oil volatility",
      tag: "Macro",
      summary: "원자재와 지정학 변화는 기업 alert와 분리해 macro layer에서 해석한다.",
      site_name: "Reuters",
      source_url: "https://www.reuters.com/",
    },
    {
      title: "Policy / disclosure / standards",
      tag: "Policy",
      summary: "공시, 규제, 표준, 연준/기관 변화를 ticker와 별도 레이어로 유지한다.",
      site_name: "Federal Register",
      source_url: "https://www.federalregister.gov/",
    },
  ],
};

function cleanSourceName(source) {
  return (source || "").replace(/ RSS$/i, "");
}

function inferThemeFromTicker(ticker) {
  const map = {
    TSLA: "Autonomous Driving",
    MSFT: "Climate / AI Infrastructure",
    RIO: "Critical Minerals",
    META: "AI Talent",
    NVDA: "AI Infrastructure",
    GOOGL: "AI Infrastructure",
    INTC: "AI Infrastructure",
  };
  return map[ticker] || "General";
}

function inferEventType(row) {
  const title = (row.display_title || row.title || "").toLowerCase();
  if (title.includes("approve") || title.includes("approval")) return "Regulatory approval";
  if (title.includes("pause")) return "Commercial pause";
  if (title.includes("interest")) return "Rumor / strategic interest";
  if (title.includes("join") || title.includes("leaders")) return "Leadership / talent";
  return "Market signal";
}

function mapGroupedAlerts(rows) {
  return (rows || []).map((row) => ({
    id: row.group_key,
    ticker: row.primary_ticker,
    title: row.display_title,
    summary: row.summary_line,
    primarySource: cleanSourceName(row.primary_source),
    primarySourceUrl: row.primary_source_url || null,
    alsoCoveredBy: (row.also_covered_by || []).map(cleanSourceName),
    alsoCoveredBySources: (row.also_covered_by_sources || []).map((x) => ({
      name: cleanSourceName(x.name),
      url: x.url || null,
    })),
    allSources: (row.all_sources || []).map((x) => ({
      name: cleanSourceName(x.name),
      url: x.url || null,
      isPrimary: !!x.is_primary,
    })),
    sourceCount: row.source_count,
    updatedAt: row.updated_at || "Now",
    theme: row.theme || inferThemeFromTicker(row.primary_ticker),
    eventType: row.event_type || inferEventType(row),
    importance: row.source_count >= 3 ? "High" : "Medium",
  }));
}

function mapWatching(rows) {
  return (rows || []).map((row, idx) => ({
    id: `watch-${idx}`,
    ticker: (row.unique_tickers || ["N/A"])[0],
    title: row.title,
    source: cleanSourceName(row.site_name),
    sourceUrl: row.source_url || null,
    why: row.why_watch || "Watch candidate",
    status: "Watch",
    quality: row.ops_reasons?.includes("opinion_like_title")
      ? "Opinion-heavy"
      : row.ops_reasons?.includes("rumor_like_title")
        ? "Rumor"
        : "Monitor",
  }));
}

function mapMultiCompany(rows) {
  return (rows || []).map((row, idx) => ({
    id: `multi-${idx}`,
    title: row.title,
    companies: row.unique_tickers || [],
    summary: row.summary || "Multiple names are moving together and should be consumed as a grouped development.",
    count: (row.unique_tickers || []).length,
    sourceCount: row.source_count || 1,
    laneReason: row.lane_reason,
    source: cleanSourceName(row.site_name),
    sourceUrl: row.source_url || null,
  }));
}

function mapMacro(rows) {
  return (rows || []).map((row, idx) => ({
    id: `macro-${idx}`,
    title: row.title,
    summary: row.summary,
    tag: row.tag,
    source: cleanSourceName(row.site_name),
    sourceUrl: row.source_url || null,
  }));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function loadPipelineBundle() {
  const [groupedAlerts, watching, multiCompany, macroCards] = await Promise.all([
    fetchJson(DATA_URLS.groupedAlerts),
    fetchJson(DATA_URLS.watching),
    fetchJson(DATA_URLS.multiCompany),
    fetchJson(DATA_URLS.macroCards),
  ]);
  return { groupedAlerts, watching, multiCompany, macroCards };
}

function LinkText({ href, children, className = "" }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 underline-offset-4 hover:underline ${className}`}>
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        <div className="mt-1 text-xs text-slate-500">{sub}</div>
      </CardContent>
    </Card>
  );
}

function SourceList({ primary, primaryUrl, alsoCoveredBySources }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Primary source</div>
        <div className="mt-2 text-sm font-medium text-slate-900">
          <LinkText href={primaryUrl} className="font-medium text-slate-900">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{primary}</span>
          </LinkText>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Also covered by</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {alsoCoveredBySources.length ? (
            alsoCoveredBySources.map((src) => (
              <Badge key={`${src.name}-${src.url || "none"}`} variant="secondary" className="rounded-full bg-white text-slate-700 hover:bg-white">
                <LinkText href={src.url} className="text-slate-700 no-underline hover:no-underline">
                  {src.name}
                </LinkText>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-slate-900">없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeView({ groupedAlerts, watching, multiCompany, macroShifts }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Top alerts" value={String(groupedAlerts.length)} sub="grouped event 기준" />
        <StatCard label="Watching" value={String(watching.length)} sub="확정 전 / 낮은 신뢰 / 추적 필요" />
        <StatCard label="Multi-company" value={String(multiCompany.length)} sub="digest로 소비해야 하는 이슈" />
        <StatCard label="Data mode" value="Pipeline" sub="현재 화면은 실제 출력 구조를 전제로 렌더링" />
      </div>

      <section>
        <SectionTitle
          title="Top Alerts"
          description="같은 사건은 한 카드로 묶고, 출처는 모두 노출합니다."
          action={<Button variant="outline" className="rounded-full">View all grouped alerts</Button>}
        />
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {groupedAlerts.map((item, idx) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
              <Card className="overflow-hidden rounded-[28px] border-slate-200/80 bg-white shadow-sm">
                <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-slate-700 to-slate-400" />
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">{item.ticker}</Badge>
                      <Badge variant="outline" className="rounded-full border-slate-300">{item.theme}</Badge>
                      <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{item.eventType}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      Updated {item.updatedAt}
                    </div>
                  </div>
                  <CardTitle className="pt-3 text-2xl leading-tight tracking-tight text-slate-950">{item.title}</CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-6 text-slate-600">{item.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <SourceList primary={item.primarySource} primaryUrl={item.primarySourceUrl} alsoCoveredBySources={item.alsoCoveredBySources} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5"><Link2 className="h-4 w-4" />Source count: {item.sourceCount}</div>
                      <div className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" />Importance: {item.importance}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.primarySourceUrl ? (
                        <Button asChild variant="outline" className="rounded-full border-slate-200">
                          <a href={item.primarySourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink className="ml-2 h-4 w-4" /></a>
                        </Button>
                      ) : null}
                      <Button className="rounded-full bg-slate-950 hover:bg-slate-800">Open event <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 2xl:grid-cols-[1.1fr_0.9fr]">
        <section>
          <SectionTitle title="Now Watching" description="alert까지는 아니지만 계속 볼 가치가 있는 후보군" />
          <div className="space-y-3">
            {watching.map((item) => (
              <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">{item.ticker}</Badge>
                        <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">{item.status}</Badge>
                        <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">{item.quality}</Badge>
                      </div>
                      <div className="mt-2 font-medium text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.why}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{item.source}</div>
                      {item.sourceUrl ? <LinkText href={item.sourceUrl} className="mt-1 text-slate-500">Open</LinkText> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Multi-company Developments" description="단일 기업 알림이 아니라 theme/digest로 소비해야 하는 이슈" />
          <div className="space-y-3">
            {multiCompany.map((item) => (
              <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.companies.map((c) => (
                          <Badge key={c} variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">{c}</Badge>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        <LinkText href={item.sourceUrl} className="text-slate-500">Source: {item.source}</LinkText>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-xs font-medium text-white">
                      <div>{item.count} names</div>
                      <div className="mt-1 text-slate-300">{item.sourceCount} sources</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section>
        <SectionTitle title="Macro Shifts" description="ticker에 억지로 붙이지 않고 별도 레이어로 유지하는 변화" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {macroShifts.map((item) => (
            <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Radio className="h-4 w-4" />
                  {item.tag}
                </div>
                <div className="mt-3 text-lg font-semibold text-slate-950">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</div>
                <div className="mt-3 text-xs text-slate-500">
                  <LinkText href={item.sourceUrl} className="text-slate-500">Source: {item.source}</LinkText>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompaniesView({ companies }) {
  const [selected, setSelected] = useState(companies[0]);

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Company Monitor</CardTitle>
          <CardDescription>회사별로 grouped event 중심으로 본다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.map((company) => (
            <button
              key={company.ticker}
              onClick={() => setSelected(company)}
              className={`w-full rounded-3xl border p-4 text-left transition ${selected.ticker === company.ticker ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-80">{company.ticker}</div>
                  <div className="mt-1 font-semibold">{company.name}</div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </div>
              <div className={`mt-3 text-sm ${selected.ticker === company.ticker ? "text-slate-200" : "text-slate-500"}`}>{company.latest}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">{selected.ticker}</Badge>
              <CardTitle>{selected.name}</CardTitle>
            </div>
            <CardDescription>{selected.theme}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Latest event</div>
              <div className="mt-2 font-medium text-slate-950">{selected.latest}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2 font-medium text-slate-950">{selected.status}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Sources</div>
              <div className="mt-2 font-medium text-slate-950">{selected.sources.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Confidence</div>
              <div className="mt-2 flex items-center gap-2 font-medium text-slate-950"><TrendingUp className="h-4 w-4" />{selected.confidence}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Source Coverage</CardTitle>
            <CardDescription>같은 사건을 다룬 출처를 하나의 이벤트 아래에 묶는다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.sources.map((source, idx) => (
              <div key={`${source.name}-${idx}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <div className="font-medium text-slate-950">
                    <LinkText href={source.url} className="text-slate-950">{source.name}</LinkText>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Coverage #{idx + 1}</div>
                </div>
                <Badge variant="outline" className="rounded-full">Coverage</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ThemesView({ themes }) {
  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
      {themes.map((theme) => (
        <Card key={theme.name} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>{theme.name}</CardTitle>
            <CardDescription>{theme.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {theme.companies.map((company) => (
                <Badge key={company} variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">{company}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Grouped cards</span>
              <span className="font-medium text-slate-950">{theme.cards}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MacroView({ macroShifts }) {
  return (
    <div className="space-y-4">
      {macroShifts.map((item) => (
        <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Globe2 className="h-4 w-4" />
              {item.tag}
            </div>
            <div className="mt-3 text-xl font-semibold text-slate-950">{item.title}</div>
            <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{item.summary}</div>
            <div className="mt-3 text-xs text-slate-500">
              <LinkText href={item.sourceUrl} className="text-slate-500">Source: {item.source}</LinkText>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SavedView({ savedItems }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {savedItems.map((item) => (
        <Card key={`${item.type}-${item.label}`} className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">{item.type}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{item.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BuildCompanies(groupedAlerts, watching) {
  const rows = [
    ...groupedAlerts.map((alert) => ({
      ticker: alert.ticker,
      name: alert.ticker,
      latest: alert.title,
      status: "Alert",
      sources: [
        { name: alert.primarySource, url: alert.primarySourceUrl || null },
        ...alert.alsoCoveredBySources.map((s) => ({ name: s.name, url: s.url || null })),
      ],
      theme: alert.theme,
      confidence: alert.sourceCount >= 3 ? 92 : 86,
    })),
    ...watching.map((item) => ({
      ticker: item.ticker,
      name: item.ticker,
      latest: item.title,
      status: "Watch",
      sources: [{ name: item.source, url: item.sourceUrl || null }],
      theme: inferThemeFromTicker(item.ticker),
      confidence: 68,
    })),
  ];

  return rows.filter((item, index, arr) => arr.findIndex((x) => x.ticker === item.ticker) === index);
}

function EmptyState({ onRetry }) {
  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-slate-400" />
        <div>
          <div className="text-lg font-semibold text-slate-950">Unable to load pipeline data</div>
          <div className="mt-1 text-sm text-slate-500">Fallback sample is being used. Adjust DATA_URLS or place JSON files under the configured paths.</div>
        </div>
        <Button variant="outline" className="rounded-full" onClick={onRetry}>Retry fetch <RefreshCcw className="ml-2 h-4 w-4" /></Button>
      </CardContent>
    </Card>
  );
}

const tabs = [
  { id: "home", label: "Home", icon: Bell },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "themes", label: "Themes", icon: Layers3 },
  { id: "macro", label: "Macro", icon: Globe2 },
  { id: "saved", label: "Saved", icon: Bookmark },
];

export default function SignalTerminalMVPApp() {
  const [activeTab, setActiveTab] = useState("home");
  const [query, setQuery] = useState("");
  const [bundle, setBundle] = useState(fallbackBundle);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const activeLabel = useMemo(() => tabs.find((t) => t.id === activeTab)?.label ?? "Home", [activeTab]);

  const hydrate = async () => {
    try {
      setLoading(true);
      const live = await loadPipelineBundle();
      setBundle(live);
      setUsingFallback(false);
    } catch (e) {
      console.warn("Using fallback pipeline bundle", e);
      setBundle(fallbackBundle);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrate();
  }, []);

  const groupedAlerts = mapGroupedAlerts(bundle.groupedAlerts);
  const watching = mapWatching(bundle.watching);
  const multiCompany = mapMultiCompany(bundle.multiCompany);
  const macroShifts = mapMacro(bundle.macroCards);
  const companies = BuildCompanies(groupedAlerts, watching);
  const themes = [
    {
      name: "AI Infrastructure",
      description: "여러 기업이 함께 움직이는 AI infra / capex / compute cluster 이슈",
      companies: ["INTC", "NVDA", "MSFT", "GOOGL", "META"],
      cards: multiCompany.length,
    },
    {
      name: "Autonomous Driving",
      description: "규제 승인, 지역 rollout, software commercialization 신호",
      companies: groupedAlerts.filter((x) => x.theme === "Autonomous Driving").map((x) => x.ticker),
      cards: groupedAlerts.filter((x) => x.theme === "Autonomous Driving").length,
    },
    {
      name: "Critical Minerals",
      description: "자산 매각, JV, 지역 정책 변화와 연결된 소재 체인 이슈",
      companies: watching.filter((x) => x.ticker === "RIO").map((x) => x.ticker),
      cards: watching.filter((x) => x.ticker === "RIO").length,
    },
  ];

  const savedItems = [
    { type: "Company", label: groupedAlerts[0]?.ticker || "TSLA" },
    { type: "Theme", label: groupedAlerts[0]?.theme || "AI Infrastructure" },
    { type: "Event", label: groupedAlerts[0]?.eventType || "Regulatory approval" },
    { type: "Source", label: groupedAlerts[0]?.primarySource || "Bloomberg Industries" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 2xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white 2xl:border-b-0 2xl:border-r">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">Signal Terminal</div>
                <div className="text-sm text-slate-500">Structured signal workspace</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                <Database className="h-3.5 w-3.5" />
                {usingFallback ? "Fallback bundle" : "Live pipeline bundle"}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {groupedAlerts.length} grouped alerts
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {usingFallback ? "JSON fetch 실패 시 sample로 동작" : "실제 JSON fetch 결과를 렌더링 중"}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="w-full rounded-full" onClick={hydrate}>
                Refresh <RefreshCcw className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="p-4 md:p-6 2xl:p-8">
          <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm text-slate-500">Signal OS / {activeLabel}</div>
              <h1 className="mt-1 max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Structured market signals, not raw article clutter.
              </h1>
            </div>
            <div className="flex w-full items-center gap-3 xl:w-[460px]">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, theme, event, source"
                  className="rounded-full border-slate-200 bg-white pl-9"
                />
              </div>
              <Button variant="outline" className="rounded-full border-slate-200">Filters</Button>
            </div>
          </div>

          {usingFallback && (
            <div className="mb-6">
              <EmptyState onRetry={hydrate} />
            </div>
          )}

          {loading ? (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-10 text-center text-slate-500">Loading pipeline bundle...</CardContent>
            </Card>
          ) : (
            <>
              {activeTab === "home" && <HomeView groupedAlerts={groupedAlerts} watching={watching} multiCompany={multiCompany} macroShifts={macroShifts} />}
              {activeTab === "companies" && <CompaniesView companies={companies} />}
              {activeTab === "themes" && <ThemesView themes={themes} />}
              {activeTab === "macro" && <MacroView macroShifts={macroShifts} />}
              {activeTab === "saved" && <SavedView savedItems={savedItems} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
