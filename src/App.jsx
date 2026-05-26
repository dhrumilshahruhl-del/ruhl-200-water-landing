import React, { useEffect } from 'react';
import { ArrowRight, Wind, Gauge, RefreshCw, ShieldCheck, MapPin, Mail, Phone, Network, ThermometerSun } from 'lucide-react';

const navy = '#00375a';
const gold = '#fcbe00';
const red = '#ef4444';

const page = {
  baselineCO2: 3154,
  retrofitCO2: 1586,
  ll97Current: 3658,
  ll97Future: 1801,
  baselineEnergy: 45919715,
  retrofitEnergy: 19179665,
};

const headlineStats = [
  ['541,000', 'sq ft', '31 floors · 576 residential units'],
  ['26%', 'energy reduction', 'ventilation retrofit vs. baseline'],
  ['664', 'tCO₂e/yr saved', 'annual ventilation retrofit impact'],
  ['2.3', 'year payback', 'with NYSERDA + in-kind'],
  ['36', 'weeks', 'kickoff to closeout'],
];

const approach = [
  { title: 'Reduce Loads', text: 'Cut heating and cooling demand before adding larger systems.', icon: Gauge },
  { title: 'Recover Heat', text: 'Transfer exhaust energy to incoming outdoor air without mixing streams.', icon: RefreshCw },
  { title: 'Modernize HVAC', text: 'Coordinate air handling, heat recovery, and staged water-source VRF support.', icon: Wind },
];

const partners = [
  { name: 'RUHL TecDesign', role: 'Lead MEP design engineering', emphasis: true, logoSrc: '/logos/ruhl.jpg', logoAlt: 'RUHL logo', logoClass: 'max-h-28 max-w-[260px]' },
  { name: 'Rockrose', role: 'Owner / development partner', emphasis: true, logoSrc: '/logos/rockrose.png', logoAlt: 'Rockrose logo', logoClass: 'max-h-16 max-w-[280px]' },
  { name: 'NYSERDA', role: '$2.0M Heat Recovery Program funding', logoSrc: '/logos/nyserda.png', logoAlt: 'NYSERDA logo', logoClass: 'max-h-24 max-w-[320px]' },
  { name: 'Swegon', role: 'GOLD F SD air-handling units', logoSrc: '/logos/swegon.png', logoAlt: 'Swegon logo', logoClass: 'max-h-24 max-w-[280px]' },
  { name: 'dena', role: 'German Energy Agency support', logoSrc: '/logos/dena.png', logoAlt: 'dena logo', logoClass: 'max-h-28 max-w-[260px]' },
  { name: 'German Energy Solutions', role: 'RES Programme support', logoSrc: '/logos/german-energy-solutions.png', logoAlt: 'Mittelstand Global Energy Solutions Made in Germany logo', logoClass: 'max-h-28 max-w-[320px]' },
];

const airflow = [
  { label: 'Exhaust Airflow', before: 74780, after: 21480, unit: 'CFM', note: 'exhaust reduced and consolidated' },
  { label: 'Supply Airflow', before: 26330, after: 28316, unit: 'CFM', note: 'supply increased to support slight positive pressure' },
];

const technology = [
  { title: 'Closed-Loop Run-Around Heat Recovery', text: 'R454B air–refrigerant–air circuit transfers sensible energy between exhaust and supply air without direct mixing.', icon: RefreshCw },
  { title: 'Centralized Exhaust + Dedicated Supply', text: 'Existing roof exhaust streams are consolidated into paired exhaust and 100% outdoor-air supply units.', icon: Network },
  { title: 'Water-Source VRF Support', text: 'R32 VRF acts as a secondary stage only when heat recovery alone cannot meet supply-air setpoints.', icon: ThermometerSun },
];

const impactCards = [
  ['11.9M', 'kBtu/yr saved', 'annual ventilation retrofit energy savings'],
  ['$277,825', 'annual cost savings', 'operational savings'],
  ['~72%', 'heat recovery effectiveness', 'closed-loop system'],
  ['$2.832M', 'total project cost', 'NYSERDA $2.0M · Rockrose $832K'],
];

const waterfallItems = [
  { label: 'Ventilation Initiatives', value: 553 },
  { label: 'ITEN™ + Heat Pump', value: 733 },
  { label: 'DHW Electrification', value: 64 },
  { label: 'Smart Controls', value: 47 },
  { label: 'Sun Protection Film', value: 101 },
  { label: 'Additional ECM Margin', value: 70 },
];

const broaderEcmReference = [
  { label: 'Exhaust Air Energy Recovery + Balancing', value: '853 tons' },
  { label: 'ITEN™ + Heat Pump + Wastewater HR', value: '1,068 tons' },
  { label: 'DHW Booster Heat Pumps', value: '93 tons' },
  { label: 'Smart Automation + Hydronics', value: '67 tons' },
  { label: 'Building Envelope Optimization', value: '148 tons' },
];

const phases = [
  ['01', 'Balance + Recover', 'Reduce apartment exhaust airflow, recover roof exhaust energy, add reversible WSHP and low-temp hot/chilled water storage; optional ASHP can inject heat into ITEN™.'],
  ['02', 'Wastewater Recovery', 'Recover heat from the internal sewer system with water-source heat pumps and low-temperature energy storage.'],
  ['03', 'DHW Low/Mid Zones', 'Introduce booster heat pump DHW for low- and mid-zones using high-temperature storage to reduce summer steam boiler operation.'],
  ['04', 'DHW High Zone', 'Extend booster heat pump DHW to the high zone and use rooftop condensing boilers for heat injection into ITEN™.'],
  ['05', 'Boiler Cascade', 'Install rooftop condensing boiler cascade using existing gas service and dismantle second-floor steam boilers.'],
  ['06', 'Public Sewer Connection', 'Connect wastewater heat recovery to the public sewer system with WSHPs and low-temperature storage.'],
];

function runDataChecks() {
  const expectedReduction = page.baselineCO2 - page.retrofitCO2;
  const waterfallReduction = waterfallItems.reduce((sum, item) => sum + item.value, 0);
  console.assert(expectedReduction === waterfallReduction, 'Waterfall reductions must bridge baseline CO₂ to retrofit CO₂.');
  console.assert(page.retrofitCO2 < page.ll97Future, 'Retrofit CO₂ should be below the 2030–2034 LL97 limit.');
  console.assert(page.baselineEnergy > page.retrofitEnergy, 'Retrofit energy use should be lower than baseline energy use.');
  console.assert(headlineStats.length === 5, 'Hero stat strip should not include a duplicate 200 Water Street stat card.');
  console.assert(partners.length === new Set(partners.map((partner) => partner.name)).size, 'Partner names should be unique.');
}
runDataChecks();

function Shell({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-7xl px-6 md:px-10 ${className}`}>{children}</div>;
}

function Section({ eyebrow, title, subtitle, children, className = '' }) {
  return (
    <section className={`py-20 md:py-24 ${className}`}>
      <Shell>
        <div className="mx-auto max-w-4xl text-center reveal">
          {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#00375a]">{eyebrow}</p> : null}
          <h2 className="text-3xl font-black tracking-tight text-[#00375a] md:text-5xl">{title}</h2>
          {subtitle ? <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-600">{subtitle}</p> : null}
        </div>
        {children}
      </Shell>
    </section>
  );
}

function LogoMark({ name, role, emphasis, logoSrc, logoAlt, logoClass = 'max-h-16 max-w-[220px]' }) {
  return (
    <div className={`group flex min-h-[260px] flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${emphasis ? 'border-[#00375a]/30' : 'border-slate-200'}`}>
      <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-white px-3 ring-1 ring-slate-100">
        <img src={logoSrc} alt={logoAlt || `${name} logo`} className={`${logoClass} w-auto object-contain`} loading="lazy" />
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4 text-center">
        <p className="text-lg font-black text-[#00375a]">{name}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{role}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label, note }) {
  return (
    <div className="reveal rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <p className="text-4xl font-black tracking-tight text-[#00375a]">{value}</p>
      <p className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-900">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{note}</p>
    </div>
  );
}

function AirflowBar({ item }) {
  const max = 80000;
  const beforeW = `${Math.min(100, (item.before / max) * 100)}%`;
  const afterW = `${Math.min(100, (item.after / max) * 100)}%`;
  return (
    <div className="reveal rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h3 className="text-xl font-black text-[#00375a]">{item.label}</h3><p className="mt-1 text-sm text-slate-500">{item.note}</p></div>
        <span className="rounded-full bg-[#fcbe00]/20 px-3 py-1 text-xs font-black text-[#00375a]">{item.unit}</span>
      </div>
      <div className="space-y-6">
        <div><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-500">Baseline</span><strong>{item.before.toLocaleString()} {item.unit}</strong></div><div className="h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-red-500 transition-all duration-1000" style={{ width: beforeW }} /></div></div>
        <div><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-500">After Retrofit</span><strong>{item.after.toLocaleString()} {item.unit}</strong></div><div className="h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-[#00375a] transition-all duration-1000" style={{ width: afterW }} /></div></div>
      </div>
    </div>
  );
}

function EmissionsThreshold() {
  const max = 4000;
  const tick = (value) => `${(value / max) * 100}%`;
  const LimitMarker = ({ value, label, top }) => (
    <div className="absolute z-20 -translate-x-1/2 text-center" style={{ left: tick(value), top }}>
      <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-wide text-[#fcbe00]">{label}</p><p className="text-xl font-black text-[#fcbe00]">{value.toLocaleString()}</p><div className="mx-auto mt-2 h-10 w-[2px] bg-[#fcbe00]" /><div className="mx-auto h-5 w-5 rounded-full border-4 border-white bg-[#fcbe00] shadow" />
    </div>
  );
  const ValueMarker = ({ value, label, color, top }) => (
    <div className="absolute z-20 -translate-x-1/2 text-center" style={{ left: tick(value), top }}>
      <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-wide" style={{ color }}>{label}</p><p className="text-xl font-black" style={{ color }}>{value.toLocaleString()}</p><div className="mx-auto mt-2 h-10 w-[2px]" style={{ background: color }} /><div className="mx-auto h-5 w-5 rounded-full border-4 border-white shadow" style={{ background: color }} />
    </div>
  );
  return (
    <div className="reveal mx-auto mt-12 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h3 className="text-2xl font-black text-[#00375a]">CO₂ Emissions vs. LL97 Limits</h3><p className="mt-2 max-w-2xl text-slate-500">Baseline and projected retrofit emissions shown against the same Local Law 97 thresholds.</p></div><div className="rounded-2xl bg-[#00375a] px-5 py-3 text-sm font-black text-white">50% projected CO₂ reduction</div></div>
      <div className="overflow-x-auto pb-2"><div className="relative h-[420px] min-w-[980px] pt-4"><div className="absolute left-0 top-[150px] text-sm font-black text-red-600">Baseline CO₂ Emissions</div><div className="absolute left-0 right-0 top-[185px] h-4 rounded-full bg-slate-200" /><div className="absolute left-0 top-[185px] h-4 rounded-full bg-red-500" style={{ width: tick(page.baselineCO2) }} /><div className="absolute left-0 top-[285px] text-sm font-black text-[#00375a]">Expected CO₂ After Retrofit</div><div className="absolute left-0 right-0 top-[320px] h-4 rounded-full bg-slate-200" /><div className="absolute left-0 top-[320px] h-4 rounded-full bg-[#00375a]" style={{ width: tick(page.retrofitCO2) }} /><ValueMarker value={page.baselineCO2} label="Baseline" color={red} top={100} /><ValueMarker value={page.retrofitCO2} label="After Retrofit" color={navy} top={235} /><LimitMarker value={page.ll97Future} label="2030–2034 Limit" top={25} /><LimitMarker value={page.ll97Current} label="2024–2029 Limit" top={25} /><div className="absolute -translate-x-1/2" style={{ left: tick(page.ll97Future), top: 235 }}><div className="h-10 w-[2px] bg-[#fcbe00]" /><div className="mx-auto h-5 w-5 rounded-full border-4 border-white bg-[#fcbe00] shadow" /></div><div className="absolute -translate-x-1/2" style={{ left: tick(page.ll97Current), top: 235 }}><div className="h-10 w-[2px] bg-[#fcbe00]" /><div className="mx-auto h-5 w-5 rounded-full border-4 border-white bg-[#fcbe00] shadow" /></div><div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs font-bold text-slate-400"><span>0</span><span>1,000</span><span>2,000</span><span>3,000</span><span>4,000 tCO₂e/year</span></div></div></div>
    </div>
  );
}

function EnergyComparison() {
  const max = 50000000;
  const beforeW = `${(page.baselineEnergy / max) * 100}%`;
  const afterW = `${(page.retrofitEnergy / max) * 100}%`;
  const reduction = Math.round((1 - page.retrofitEnergy / page.baselineEnergy) * 100);
  return (
    <div className="reveal mx-auto mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h3 className="text-2xl font-black text-[#00375a]">Projected Energy Use: Baseline vs. Retrofit</h3><p className="mt-2 text-slate-500">A simple before/after view using the energy values from the project data.</p></div><div className="rounded-2xl bg-[#fcbe00]/20 px-5 py-3 text-sm font-black text-[#00375a]">{reduction}% reduction in energy use</div></div><div className="space-y-8"><div><div className="mb-2 flex justify-between text-sm"><span className="font-black text-red-600">Baseline Energy Use</span><strong>{page.baselineEnergy.toLocaleString()} MBtu/year</strong></div><div className="h-5 rounded-full bg-slate-200"><div className="h-5 rounded-full bg-red-500" style={{ width: beforeW }} /></div></div><div><div className="mb-2 flex justify-between text-sm"><span className="font-black text-[#00375a]">Expected Energy Use After Retrofit</span><strong>{page.retrofitEnergy.toLocaleString()} MBtu/year</strong></div><div className="h-5 rounded-full bg-slate-200"><div className="h-5 rounded-full bg-[#00375a]" style={{ width: afterW }} /></div></div><div className="flex justify-between text-xs font-bold text-slate-400"><span>0</span><span>10M</span><span>20M</span><span>30M</span><span>40M</span><span>50M MBtu/year</span></div></div></div>
  );
}

function Waterfall() {
  const baseline = page.baselineCO2;
  const retrofit = page.retrofitCO2;
  const max = 4000;
  const chartH = 360;
  let current = baseline;
  const h = (value) => (value / max) * chartH;
  const yTop = (value) => chartH - h(value);
  const allBars = [{ type: 'start', label: 'Baseline Emissions', value: baseline }, ...waterfallItems.map((item) => ({ type: 'reduction', ...item })), { type: 'end', label: 'Projected Retrofit', value: retrofit }];
  const gridTemplateColumns = `repeat(${allBars.length}, minmax(110px, 1fr))`;
  return (
    <div className="reveal mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h3 className="text-2xl font-black text-[#00375a]">Emission Reduction Waterfall</h3><p className="mt-2 max-w-3xl text-slate-500">Bridge from baseline emissions to projected retrofit emissions. Yellow bars start at the previous level and step down to the final retrofit value.</p></div><div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-[#00375a]">Units: tCO₂e/year</div></div><div className="mt-10 overflow-x-auto"><div className="relative min-w-[1120px] pl-20 pr-8" style={{ height: chartH + 150 }}>{[0, 1000, 2000, 3000, 4000].map((tick) => <div key={tick} className="absolute left-20 right-8 border-t border-dashed border-slate-200" style={{ top: yTop(tick) }}><span className="absolute -left-14 -top-3 text-xs font-bold text-slate-400">{tick.toLocaleString()}</span></div>)}<div className="absolute left-2 top-[150px] -rotate-90 text-sm font-black text-[#00375a]">Emissions (tCO₂e/year)</div><div className="absolute left-20 right-8 grid" style={{ gridTemplateColumns, height: chartH }}>{allBars.map((bar, index) => { if (bar.type === 'start' || bar.type === 'end') { return <div key={`${bar.type}-${index}`} className="relative flex justify-center"><div className="absolute bottom-0 w-20 rounded-t-xl bg-[#00375a]" style={{ height: h(bar.value) }} /><p className="absolute text-sm font-black text-[#00375a]" style={{ bottom: h(bar.value) + 10 }}>{bar.value.toLocaleString()}</p><p className="absolute top-[382px] max-w-[105px] text-center text-xs font-black leading-4 text-slate-900">{bar.label}</p></div>; } current -= bar.value; const bottom = h(current); const height = h(bar.value); return <div key={`${bar.type}-${index}`} className="relative flex justify-center"><div className="absolute w-20 rounded-sm bg-[#fcbe00]" style={{ bottom, height }} /><p className="absolute text-sm font-black text-slate-900" style={{ bottom: bottom + height + 10 }}>{bar.value.toLocaleString()}</p><p className="absolute top-[382px] max-w-[105px] text-center text-xs font-black leading-4 text-slate-900">{bar.label}</p></div>; })}</div><div className="absolute bottom-10 left-20 right-8 h-[1px] bg-slate-300" /><div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm font-black text-[#00375a]">Emission pathway measures</div></div></div><div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600"><strong className="text-[#00375a]">Broader ECM reference from the project data:</strong> {broaderEcmReference.map((item) => `${item.label}: ${item.value}`).join(' · ')}.</div></div>
  );
}

function App() {
  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f8] text-[#0b1724]">
      <section className="relative overflow-hidden bg-white"><div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#fcbe00]/10 blur-3xl" /><Shell className="relative py-20 md:py-28"><div className="mx-auto max-w-5xl text-center reveal"><div className="mb-8 flex flex-wrap items-center justify-center gap-3"><span className="rounded-full bg-[#00375a] px-5 py-2 text-sm font-black text-white">RUHL TecDesign</span><span className="text-[#fcbe00]">×</span><span className="rounded-full bg-white px-5 py-2 text-sm font-black text-[#00375a] shadow-sm ring-1 ring-slate-200">Rockrose</span><span className="text-[#fcbe00]">·</span><span className="rounded-full bg-[#fcbe00] px-5 py-2 text-sm font-black text-[#00375a]">200 Water Street Project</span></div><p className="text-sm font-black uppercase tracking-[0.28em] text-[#00375a]">Closed-loop heat recovery for a 31-story Manhattan residence</p><h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight text-[#00375a] md:text-7xl">200 Water Street Ventilation Retrofit</h1><p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-slate-600">Rebalancing airflow, recovering exhaust energy, and creating a scalable path toward Local Law 97 compliance for large multifamily buildings.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><a href="#solution" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00375a] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#00375a]/20 transition hover:-translate-y-1">See how it works <ArrowRight size={18} /></a><a href="#impact" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#00375a] bg-white px-6 py-4 text-sm font-black text-[#00375a] transition hover:-translate-y-1">View impact data</a></div></div><div className="mt-14 grid gap-4 md:grid-cols-3 lg:grid-cols-5">{headlineStats.map(([value, label, note]) => <StatCard key={label} value={value} label={label} note={note} />)}</div></Shell></section>
      <Section eyebrow="Organizations" title="Project leadership, funding, technology, and support." subtitle="The page gives RUHL and Rockrose clear visibility while still showing the public project ecosystem around NYSERDA, Swegon, dena, and the German Energy Solutions Initiative."><div className="mt-12 grid auto-rows-fr gap-5 md:grid-cols-2 lg:grid-cols-3">{partners.map((partner) => <LogoMark key={partner.name} {...partner} />)}</div></Section>
      <section id="solution" className="bg-white"><Section eyebrow="Engineering approach" title="Efficiency-led retrofit: reduce, recover, modernize." subtitle="The retrofit attacks the building's core ventilation problem first: uncontrolled exhaust, pressure imbalance, and wasted thermal energy."><div className="mt-12 grid gap-5 md:grid-cols-3">{approach.map((item) => { const Icon = item.icon; return <div key={item.title} className="reveal rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#00375a] text-[#fcbe00]"><Icon size={34} /></div><h3 className="mt-6 text-2xl font-black text-[#00375a]">{item.title}</h3><p className="mt-3 leading-7 text-slate-600">{item.text}</p></div>; })}</div><div className="mt-12 grid gap-5 md:grid-cols-2"><div className="reveal rounded-[2rem] bg-[#00375a] p-8 text-white"><h3 className="text-2xl font-black">The challenge</h3><p className="mt-4 leading-7 text-white/80">Multiple roof exhaust systems operated continuously without heat recovery or supply coordination, producing a 284% negative-pressure regime and high infiltration losses through doors, windows, and façade leakage.</p></div><div className="reveal rounded-[2rem] bg-[#fcbe00] p-8 text-[#00375a]"><h3 className="text-2xl font-black">The solution</h3><p className="mt-4 leading-7">Centralized exhaust and dedicated outdoor-air supply units connected by a closed-loop refrigerant heat recovery circuit, with water-source VRF support only when recovered heat cannot meet setpoints.</p></div></div></Section></section>
      <Section eyebrow="System strategy" title="Airflow rebalanced to reduce infiltration losses." subtitle="The proposed system reduces excessive exhaust, increases coordinated supply air, and moves the building toward balanced/slight positive pressure."><div className="mt-12 grid gap-5 md:grid-cols-2">{airflow.map((item) => <AirflowBar key={item.label} item={item} />)}</div><div className="reveal mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm"><p className="text-3xl font-black text-[#00375a]">284% negative pressure → balanced / slight positive</p><p className="mt-2 text-slate-500">Ventilation losses collapse when exhaust and supply air are coordinated.</p></div><div className="mt-10 grid gap-5 md:grid-cols-3">{technology.map((item) => { const Icon = item.icon; return <div key={item.title} className="reveal rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><Icon className="text-[#00375a]" size={30} /><h3 className="mt-5 text-xl font-black text-[#00375a]">{item.title}</h3><p className="mt-3 leading-7 text-slate-600">{item.text}</p></div>; })}</div></Section>
      <section id="impact" className="bg-white"><Section eyebrow="Measured impact" title="Clear evidence for builders, owners, and engineers." subtitle="Key values are shown as visual components instead of raw tables, with units and thresholds kept visible for technical credibility."><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{impactCards.map(([value, label, note]) => <StatCard key={label} value={value} label={label} note={note} />)}</div><EmissionsThreshold /><EnergyComparison /><Waterfall /></Section></section>
      <Section eyebrow="Implementation" title="36-week retrofit roadmap." subtitle="A phased view of the broader retrofit strategy, including supporting controls and adaptation measures."><div className="mt-12"><div className="relative border-l-4 border-[#00375a] pl-7">{phases.map(([num, title, text]) => <div key={num} className="reveal relative mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="absolute -left-[3.35rem] top-6 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#00375a] text-lg font-black text-[#fcbe00] shadow">{num}</div><h3 className="text-xl font-black text-[#00375a]">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></div>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-[#00375a] p-6 text-white"><strong>Supporting measures:</strong> BMS upgrades, smart automation, hydronic optimization, solid-state heat pump replacement, app-based room control, and demand-based primary flow control.</div><div className="rounded-3xl bg-[#fcbe00] p-6 text-[#00375a]"><strong>Adaptation measures:</strong> building envelope optimization with sun protection screens to manage climate-related cooling load increases.</div></div></div></Section>
      <section className="bg-[#00375a] text-white"><Shell className="grid gap-10 py-20 md:grid-cols-[1fr_0.85fr] md:py-24"><div className="reveal"><p className="text-xs font-black uppercase tracking-[0.24em] text-[#fcbe00]">What RUHL delivers</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">A replicable retrofit model for multifamily decarbonization.</h2><p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">RUHL's scope connects decarbonization roadmaps, engineering integration, and measurement frameworks for heat recovery, ventilation balance, hydronic optimization, and heat pump integration.</p></div><div className="space-y-4 reveal">{['Decarbonization Roadmaps', 'Engineering & Integration', 'Measurement & Verification', 'Heat Recovery + HVAC Modernization'].map((item) => <div key={item} className="flex items-center gap-4 rounded-2xl bg-white/10 p-5 ring-1 ring-white/10"><ShieldCheck className="text-[#fcbe00]" /><span className="font-black">{item}</span></div>)}</div></Shell></section>
      <footer className="bg-white py-16"><Shell><div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-[#f7f8f8] p-8 md:grid-cols-[1fr_0.9fr]"><div><h2 className="text-3xl font-black text-[#00375a]">Interested in heat recovery, HVAC modernization, or a decarbonization roadmap?</h2><p className="mt-4 text-slate-600">Contact RUHL TecDesign to discuss building-scale retrofit strategy and implementation.</p></div><div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xl font-black text-[#00375a]">RUHL TecDesign LLC</p><p className="mt-4 flex items-center gap-3 text-slate-600"><MapPin size={18} /> One World Trade Center, New York, NY 10007</p><p className="mt-3 flex items-center gap-3 text-slate-600"><Mail size={18} /> info@ruhl.org</p><p className="mt-3 flex items-center gap-3 text-slate-600"><Phone size={18} /> (212) 555-0123</p></div></div></Shell></footer>
    </main>
  );
}

export default App;
