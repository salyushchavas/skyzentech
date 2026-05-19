import type { Metadata } from 'next';
import Link from 'next/link';
import SiteLayout from '@/components/SiteLayout';
import ParticleCanvas from '@/components/ParticleCanvas';

export const metadata: Metadata = {
  title: 'Skyzen Technologies LLC | IT Consulting, Staffing & STEM Internships',
  description:
    'Skyzen Technologies LLC is a premier IT consulting, software development, staffing, and career training company based in Plano, TX. Connecting talent with top US enterprises and running a hands-on STEM internship program.',
  keywords:
    'IT consulting Plano TX, IT staffing Texas, software development, STEM internships, career training, job placement, Skyzen Technologies',
  authors: [{ name: 'Skyzen Technologies LLC' }],
  robots: 'index, follow',
  alternates: { canonical: 'https://www.skyzentech.com/' },
  openGraph: {
    type: 'website',
    url: 'https://www.skyzentech.com/',
    title: 'Skyzen Technologies LLC | IT Consulting & Staffing',
    description:
      'Premier IT consulting, software development, staffing and STEM internships in Plano, TX. Trusted by 21+ enterprise clients.',
    images: 'https://www.skyzentech.com/images/banner-2.jpg',
    siteName: 'Skyzen Technologies LLC',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skyzen Technologies LLC | IT Consulting & Staffing',
    description: 'Premier IT consulting, staffing and STEM internships in Plano, TX.',
    images: 'https://www.skyzentech.com/images/banner-2.jpg',
  },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Skyzen Technologies LLC',
  url: 'https://www.skyzentech.com',
  logo: 'https://www.skyzentech.com/images/skyzen-logo.png',
  description:
    'Premier IT consulting, software development, staffing and career training company based in Plano, TX.',
  foundingDate: '2020',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '5465 Legacy Drive, Suite 650',
    addressLocality: 'Plano',
    addressRegion: 'TX',
    postalCode: '75024',
    addressCountry: 'US',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-469-945-3339',
    contactType: 'customer service',
    email: 'info@skyzentech.com',
    availableLanguage: 'English',
  },
  sameAs: ['https://www.linkedin.com/company/skyzen-tech-llc/'],
};

const SERVICES = [
  {
    num: '01',
    icon: 'icofont-code-alt',
    title: 'Software Consulting & Development',
    body: 'Customized software solutions built for scale and reliability. We integrate across platforms and drive your digital transformation with technologies like Java, .NET, ServiceNow, and more.',
  },
  {
    num: '02',
    icon: 'icofont-book',
    title: 'Technical Training Programs',
    body: 'Hands-on courses with real-time working assessments that make candidates job-ready at an industrial level — covering Java, DevOps, Cloud, Data Engineering, QA, Salesforce and more.',
  },
  {
    num: '03',
    icon: 'icofont-people',
    title: 'Recruitment & IT Staffing',
    body: 'Empanelled with top recruiting agencies across the United States and a preferred vendor to many. We provide staffing from entry level to Architect level across all major IT domains.',
  },
  {
    num: '04',
    icon: 'icofont-chart-growth',
    title: 'Management Consulting',
    body: 'Strategic planning, operational efficiency, digital marketing, security compliance, and business transformation — helping your organization adapt and achieve sustainable growth.',
  },
  {
    num: '05',
    icon: 'icofont-shield',
    title: 'Security & Compliance',
    body: 'Protect your data, meet regulatory requirements, and maintain industry standards with our security guidance and compliance frameworks tailored to your business needs.',
  },
  {
    num: '06',
    icon: 'icofont-tasks-alt',
    title: 'Project Management',
    body: 'Expert project management, process optimization, and performance improvement ensuring your initiatives are delivered on time, within scope, and aligned with business goals.',
  },
];

const ABOUT_STATS = [
  { icon: 'icofont-graduate', label: 'Professionals Trained' },
  { icon: 'icofont-building', label: 'Enterprise Clients' },
  { icon: 'icofont-code-alt', label: 'Technologies Covered' },
  { icon: 'icofont-support', label: 'Support Available' },
];

const WHY_FEATURES = [
  {
    icon: 'icofont-handshake-deal',
    title: 'Preferred Vendor Status',
    body: 'Empanelled with top recruiting agencies across the United States and recognized as a preferred vendor to many — giving our candidates a direct edge in job placement.',
  },
  {
    icon: 'icofont-loop',
    title: 'End-to-End Solutions',
    body: 'From training with real-time assessments to full career placement — entry level to Architect level. We guide every candidate through the complete journey.',
  },
  {
    icon: 'icofont-users-alt-5',
    title: 'Industry-Level Training',
    body: 'Our technical courses include real-time working assessments that prepare candidates to meet actual industrial demands — not just theory, but hands-on readiness.',
  },
  {
    icon: 'icofont-checked',
    title: 'Proven Placement Record',
    body: 'Trusted by Fortune 500 companies including Wells Fargo, JP Morgan, AT&T, Deloitte and more — our consistent placement record speaks for itself.',
  },
];

const CLIENT_CHIPS = [
  'Wells Fargo', 'JP Morgan', 'AT&T', 'Deloitte', 'Mastercard',
  'Cisco', 'GE', 'T-Mobile', 'US Bank', 'Verizon',
];

const TECH_CHIPS = [
  'Java (Full Stack)', '.NET (Full Stack)', 'DevOps / AWS / GCP',
  'Data Engineering', 'ETL Development', 'QA Automation', 'QA Manual',
  'Salesforce', 'Python', 'UI/UX Design', 'Network Engineering',
  'Cyber Security', 'Oracle HCM', 'Oracle DB Admin', 'Oracle NetSuite',
  'Workday', 'ServiceNow', 'PowerBI',
];

const TRAINING_PROGRAMS = [
  { icon: 'icofont-coffee-alt', title: 'Java Full Stack', detail: 'Core Java, Spring Boot, Microservices, REST APIs' },
  { icon: 'icofont-code-alt',   title: '.NET Full Stack', detail: 'C#, ASP.NET Core, MVC, Entity Framework' },
  { icon: 'icofont-loop',       title: 'DevOps / AWS / GCP', detail: 'Docker, Kubernetes, Jenkins, CI/CD Pipelines' },
  { icon: 'icofont-database',   title: 'Data Engineering & ETL', detail: 'Spark, Pipelines, ETL, Data Warehousing' },
  { icon: 'icofont-check-circled', title: 'QA & Testing', detail: 'Selenium, API Testing, Manual & Automation' },
  { icon: 'icofont-people',     title: 'Salesforce', detail: 'Admin, Developer, Sales Cloud, Service Cloud' },
  { icon: 'icofont-code-alt',   title: 'Python', detail: 'Scripting, Data Analysis, Automation, ML basics' },
  { icon: 'icofont-chart-flow', title: 'Real-Time Assessments', detail: 'Industry-level projects to make you job-ready' },
];

const CAREER_PILLARS = [
  {
    icon: 'icofont-briefcase',
    title: 'Real client projects',
    body: 'Work on production systems with US enterprise clients — not toy assignments.',
  },
  {
    icon: 'icofont-teacher',
    title: 'Structured mentorship',
    body: 'Weekly assignments + biweekly technical-evaluator sessions throughout the program.',
  },
  {
    icon: 'icofont-shield',
    title: 'STEM OPT compliant',
    body: 'Full I-983 training plan, I-9 verification, and E-Verify support handled in-house.',
  },
];

const CLIENT_LOGO_IDS = Array.from({ length: 21 }, (_, i) => i + 1);
const TECH_LOGO_IDS = Array.from({ length: 6 }, (_, i) => i + 1);

export default function HomePage() {
  return (
    <SiteLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* =====================================================
          HERO  (particle/constellation animation behind content)
      ===================================================== */}
      <section
        id="hero"
        className="relative isolate overflow-hidden bg-skyzen-dark px-6 py-32 text-skyzen-text md:py-40"
      >
        <ParticleCanvas />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Software Consulting &amp; IT Staffing
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl">
            We Provide{' '}
            <span className="bg-gradient-to-br from-accent to-accent-light bg-clip-text text-transparent">
              Strategic IT Solutions
            </span>
          </h1>

          <p className="mt-5 text-lg text-skyzen-muted sm:text-xl md:text-2xl">
            Smart Solutions for a Digital Future
          </p>

          <p className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-skyzen-muted">
            <strong className="text-accent">Skyzen Technologies LLC</strong> — Empowering your
            business with innovative IT solutions to grow smarter, faster, and stay ahead.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/careers/openings"
              className="rounded-full bg-gradient-to-r from-accent to-accent-dark px-8 py-3.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
            >
              Explore Careers
            </Link>
            <a
              href="#contact"
              className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-semibold text-white transition hover:border-accent hover:bg-accent/5 hover:text-accent"
            >
              Get In Touch
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 flex flex-wrap items-stretch justify-center gap-4">
            <a
              href="#clients"
              className="flex w-44 flex-col items-center gap-2 rounded-2xl border border-skyzen-border bg-skyzen-dark/40 px-6 py-5 text-skyzen-muted backdrop-blur-sm transition hover:-translate-y-1 hover:border-accent/45 hover:bg-accent/5 hover:text-white"
            >
              <i className="icofont-building text-3xl text-accent" />
              <span className="text-xs font-medium tracking-wide">Enterprise Clients</span>
            </a>
            <a
              href="#technology"
              className="flex w-44 flex-col items-center gap-2 rounded-2xl border border-skyzen-border bg-skyzen-dark/40 px-6 py-5 text-skyzen-muted backdrop-blur-sm transition hover:-translate-y-1 hover:border-accent/45 hover:bg-accent/5 hover:text-white"
            >
              <i className="icofont-code-alt text-3xl text-accent" />
              <span className="text-xs font-medium tracking-wide">Technologies</span>
            </a>
            <div className="flex w-44 flex-col items-center gap-1 rounded-2xl border border-skyzen-border bg-skyzen-dark/40 px-6 py-5 backdrop-blur-sm">
              <div className="text-4xl font-extrabold leading-none text-white">
                100<span className="text-accent">%</span>
              </div>
              <div className="text-xs font-medium tracking-wide text-skyzen-muted">
                Commitment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ABOUT
      ===================================================== */}
      <section id="about" className="bg-skyzen-light px-6 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <img
              src="/images/about.jpg"
              alt="About Skyzen"
              className="w-full rounded-2xl shadow-xl"
            />
          </div>
          <div>
            <SectionTag label="About Us" />
            <h2 className="mb-5 text-3xl font-bold text-skyzen-navy md:text-4xl">
              Welcome to <span className="text-accent">Skyzen Technologies LLC</span>
            </h2>
            <p className="mb-4 text-base leading-relaxed text-slate-600">
              At <strong className="text-accent">Skyzen Technologies LLC</strong>, we are a{' '}
              <strong>Software Consulting &amp; IT Staffing Company</strong> committed to bridging
              the gap between talent and technology.
            </p>
            <p className="mb-6 text-base leading-relaxed text-slate-600">
              We provide technical courses training with real-time working assessments, making
              candidates job-ready at an industrial level. Empanelled with top recruiting
              agencies across the United States and a preferred vendor to many, we deliver
              staffing solutions from entry level to Architect level.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {ABOUT_STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <i className={`${s.icon} mb-2 block text-3xl text-accent`} />
                  <div className="text-sm text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          WHAT WE DO
      ===================================================== */}
      <section id="what-we-do" className="bg-skyzen-dark2 px-6 py-24 text-skyzen-text">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <SectionTag label="What We Do" center />
            <h2 className="bg-gradient-to-br from-white via-white to-accent bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Our Core Services
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-skyzen-muted">
              We offer a comprehensive range of services designed to help businesses and
              individuals thrive in the digital era.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                key={s.num}
                className="group relative overflow-hidden rounded-2xl border border-skyzen-border bg-skyzen-card p-8 transition hover:-translate-y-1.5 hover:border-accent/30 hover:shadow-2xl"
              >
                <span className="pointer-events-none absolute right-6 top-6 text-5xl font-extrabold leading-none text-white/5">
                  {s.num}
                </span>
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-2xl text-accent transition group-hover:bg-accent/20">
                  <i className={s.icon} />
                </div>
                <h4 className="mb-3 text-lg font-bold text-white">{s.title}</h4>
                <p className="text-sm leading-relaxed text-skyzen-muted">{s.body}</p>
                <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-accent to-accent-dark transition group-hover:scale-x-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY WE
      ===================================================== */}
      <section id="why-we" className="bg-skyzen-light px-6 py-24">
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex h-full flex-col justify-center rounded-3xl bg-skyzen-navy p-12 text-white">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Why Choose Us
              </div>
              <h3 className="mb-4 text-3xl font-bold leading-tight">
                Where Technology
                <br />
                Meets <span className="text-accent">Excellence</span>
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-[#a8c8e8]">
                Our dynamic team combines deep industry expertise with a passion for results —
                connecting IT talent with the world&apos;s leading organizations.
              </p>
              <div className="flex flex-wrap gap-2">
                {CLIENT_CHIPS.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-accent/20 bg-accent/10 px-3.5 py-1 text-xs font-medium text-accent"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <SectionTag label="Our Differentiators" />
            <h2 className="mb-8 text-3xl font-bold text-skyzen-navy md:text-4xl">
              Why We Stand Out
            </h2>
            <div className="space-y-2">
              {WHY_FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex gap-4 rounded-xl p-5 transition hover:bg-white hover:shadow"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <i className={`${f.icon} text-lg`} />
                  </div>
                  <div>
                    <h5 className="mb-1 text-base font-bold text-skyzen-navy">{f.title}</h5>
                    <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          OUR EXPERTISE
      ===================================================== */}
      <section id="our-expertise" className="bg-skyzen-dark px-6 py-24 text-skyzen-text">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <SectionTag label="Our Expertise" center />
            <h2 className="bg-gradient-to-br from-white via-white to-accent bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Technologies &amp; Training
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-skyzen-muted">
              Cutting-edge technologies and comprehensive training programs to keep you ahead
              of the curve.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h5 className="mb-1 text-base font-bold text-white">Technology Stack</h5>
              <p className="mb-5 text-sm text-skyzen-muted">
                Technologies we are pioneered in marketing, consulting and placing talent:
              </p>
              <div className="flex flex-wrap gap-2">
                {TECH_CHIPS.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-skyzen-border bg-skyzen-card px-4 py-1.5 text-xs font-medium text-skyzen-text transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h5 className="mb-1 text-base font-bold text-white">Training Programs</h5>
              <p className="mb-5 text-sm text-skyzen-muted">
                Hands-on programs combining practical knowledge with real-world industry
                insights:
              </p>
              <div className="space-y-2.5">
                {TRAINING_PROGRAMS.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-center gap-3.5 rounded-xl border border-skyzen-border bg-skyzen-card px-5 py-4 transition hover:border-accent/30 hover:bg-accent/5"
                  >
                    <i className={`${p.icon} text-xl text-accent`} />
                    <div>
                      <h6 className="text-sm font-semibold text-white">{p.title}</h6>
                      <span className="text-xs text-skyzen-muted">{p.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SKYZEN CAREERS — enhanced career section + primary CTA
      ===================================================== */}
      <section
        id="career-support"
        className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-accent-dark px-6 py-24 text-white"
      >
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
            Now hiring
          </div>
          <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl">
            Skyzen STEM Internship Program
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            Hands-on internships with top US companies. Real projects, structured
            mentorship, STEM OPT compliance built in.
          </p>

          <div className="mt-12 grid gap-6 text-left md:grid-cols-3">
            {CAREER_PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition hover:bg-white/15"
              >
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl">
                  <i className={p.icon} />
                </div>
                <h4 className="mb-1.5 text-base font-bold">{p.title}</h4>
                <p className="text-sm leading-relaxed text-white/85">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link
              href="/careers/openings"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-accent-dark shadow-xl transition hover:-translate-y-0.5 hover:bg-skyzen-light"
            >
              Explore Open Internships
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          CLIENTS
      ===================================================== */}
      <section
        id="clients"
        className="border-y border-skyzen-border bg-skyzen-dark2 px-6 py-20 text-skyzen-text"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <SectionTag label="Trusted By" center />
            <h2 className="bg-gradient-to-br from-white via-white to-accent bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Our Clients
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {CLIENT_LOGO_IDS.map((n) => (
              <div
                key={n}
                className="flex h-20 items-center justify-center rounded-xl border border-skyzen-border bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-accent/25 hover:bg-accent/5"
              >
                <img
                  src={`/images/client-logos/${n}.jpg`}
                  alt={`Client logo ${n}`}
                  className="max-h-10 max-w-[110px] object-contain opacity-75 [filter:grayscale(100%)_brightness(1.6)_contrast(0.8)] transition hover:opacity-100 hover:[filter:none]"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          TECHNOLOGY
      ===================================================== */}
      <section
        id="technology"
        className="border-b border-skyzen-border bg-skyzen-dark3 px-6 py-20 text-skyzen-text"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <SectionTag label="Tech Stack" center />
            <h2 className="bg-gradient-to-br from-white via-white to-accent bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Technologies We Work With
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TECH_LOGO_IDS.map((n) => (
              <div
                key={n}
                className="flex h-20 items-center justify-center rounded-xl border border-skyzen-border bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-accent/25 hover:bg-accent/5"
              >
                <img
                  src={`/images/technology-logos/${n}.jpg`}
                  alt={`Technology logo ${n}`}
                  className="max-h-10 max-w-[110px] object-contain opacity-75 [filter:grayscale(100%)_brightness(1.6)_contrast(0.8)] transition hover:opacity-100 hover:[filter:none]"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA BANNER
      ===================================================== */}
      <section className="bg-gradient-to-br from-skyzen-navy to-[#1a3d6b] px-6 py-20 text-center text-white">
        <h2 className="text-3xl font-bold md:text-4xl">
          Have a Question or Need IT Solutions?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#a8c8e8]">
          Let&apos;s discuss how Skyzen Technologies can help your business grow and your career
          take off.
        </p>
        <a
          href="#contact"
          className="mt-8 inline-block rounded-full bg-gradient-to-r from-accent to-accent-dark px-8 py-3.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
        >
          Get In Touch Today
        </a>
      </section>

      {/* =====================================================
          CONTACT
      ===================================================== */}
      <section id="contact" className="bg-skyzen-dark2 px-6 py-24 text-skyzen-text">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <SectionTag label="Contact Us" center />
            <h2 className="bg-gradient-to-br from-white via-white to-accent bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Let&apos;s Start a Conversation
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-skyzen-muted">
              Feel free to reach out any time. We&apos;ll get back to you soon.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Info card */}
            <div className="lg:col-span-5">
              <div className="h-full rounded-2xl border border-skyzen-border bg-skyzen-card p-10">
                <h3 className="mb-2 text-2xl font-bold text-white">Get In Touch</h3>
                <p className="mb-7 text-sm leading-relaxed text-skyzen-muted">
                  We&apos;re here to help. Reach us through any of the channels below and our
                  team will respond promptly.
                </p>

                <ContactDetail
                  icon="icofont-phone"
                  label="Phone"
                  primary={<a href="tel:4699453339">+1 469-945-3339</a>}
                />
                <ContactDetail
                  icon="icofont-email"
                  label="Email"
                  primary={<a href="mailto:info@skyzentech.com">info@skyzentech.com</a>}
                />
                <ContactDetail
                  icon="icofont-location-pin"
                  label="Address"
                  primary={
                    <span className="whitespace-pre-line">
                      {`5465 Legacy Drive, Suite 650,\nPlano, TX 75024`}
                    </span>
                  }
                />
                <ContactDetail
                  icon="icofont-linkedin"
                  label="LinkedIn"
                  primary={
                    <a
                      href="https://www.linkedin.com/company/skyzen-tech-llc/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      skyzen-tech-llc
                    </a>
                  }
                  last
                />
              </div>
            </div>

            {/* Contact form — visual placeholder (TODO: wire to Next.js route handler in a later phase) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-skyzen-border bg-skyzen-card p-10">
                <h4 className="mb-1.5 text-xl font-bold text-white">Send Us a Message</h4>
                <p className="mb-7 text-sm text-skyzen-muted">
                  Fill in the form below and we&apos;ll ping you back!
                </p>
                {/* TODO: port the legacy contact.php POST handler. For now this form is a
                    visual placeholder (no submit handler wired). */}
                <form
                  className="space-y-4"
                  aria-label="Contact form (placeholder)"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="First Name" name="firstName" placeholder="John" />
                    <FormField label="Last Name" name="lastName" placeholder="Doe" />
                    <FormField label="Email Address" name="email" type="email" placeholder="john@example.com" />
                    <FormField label="Phone Number" name="phone" type="tel" placeholder="+1 (___) ___-____" />
                  </div>
                  <FormField label="Message" name="message" textarea placeholder="Tell us how we can help..." />

                  <div className="flex items-start gap-2.5 text-xs leading-relaxed text-skyzen-muted">
                    <input
                      type="checkbox"
                      id="contactConsent"
                      className="mt-1 h-4 w-4 accent-accent"
                    />
                    <label htmlFor="contactConsent">
                      Check this box to confirm you agree to be contacted regarding your
                      inquiry. Message and data rates may apply.
                    </label>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-3.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
                    aria-disabled="true"
                    title="Contact form not yet wired — coming soon"
                  >
                    Send Message
                    <i className="icofont-paper-plane ml-2" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

/* ---------- Small helpers (server-component-safe) ---------- */

function SectionTag({ label, center = false }: { label: string; center?: boolean }) {
  return (
    <div
      className={
        'mb-3.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent ' +
        (center ? 'justify-center' : '')
      }
    >
      <span className="h-0.5 w-6 rounded-sm bg-accent" />
      {label}
    </div>
  );
}

function ContactDetail({
  icon,
  label,
  primary,
  last = false,
}: {
  icon: string;
  label: string;
  primary: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-3.5 py-3.5 ' +
        (last ? '' : 'border-b border-skyzen-border')
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent">
        <i className={icon} />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-skyzen-muted">
          {label}
        </div>
        <div className="text-sm font-medium text-skyzen-text hover:[&_a]:text-accent">
          {primary}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  textarea = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  const sharedClass =
    'w-full rounded-lg border border-skyzen-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-accent/50 focus:bg-accent/5 focus:outline-none';
  return (
    <div>
      <label
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-skyzen-muted"
        htmlFor={name}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={4}
          placeholder={placeholder}
          className={sharedClass + ' resize-y'}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          className={sharedClass}
        />
      )}
    </div>
  );
}
