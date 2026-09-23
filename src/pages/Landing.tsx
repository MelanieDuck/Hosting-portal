import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  MousePointerClick,
  Smartphone,
  Search,
  Gauge,
  Palette,
  Rocket,
  Shield,
  Zap,
  Star,
  Menu,
  X,
} from 'lucide-react';
import { Logo } from '@/components/Logo';

const HERO_IMG =
  'https://images.pexels.com/photos/285814/pexels-photo-285814.jpeg?auto=compress&cs=tinysrgb&w=1260&h=800&dpr=2';
const WORKSPACE_IMG =
  'https://images.pexels.com/photos/13451104/pexels-photo-13451104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=800&dpr=2';
const COLLAB_IMG =
  'https://images.pexels.com/photos/7675016/pexels-photo-7675016.jpeg?auto=compress&cs=tinysrgb&w=1260&h=800&dpr=2';

const faqs: { q: string; a: string }[] = [
  {
    q: 'What are your fees?',
    a: 'A one-time fee of £250 covers the complete design and build of your landing page. After that, a simple £12 monthly hosting fee keeps your site live, fast, and secure — with no hidden costs or surprises.',
  },
  {
    q: 'Will I own my domain?',
    a: 'Absolutely. You own your domain name outright. We handle the hosting and technical setup, but the domain is registered in your name and stays yours for as long as you want it.',
  },
  {
    q: 'What is your cancellation policy?',
    a: 'You can cancel at any time directly from your client dashboard — no phone calls, no awkward conversations, no cancellation fees. Your subscription is month-to-month, and you are always in control.',
  },
  {
    q: 'What if I want to change the design?',
    a: 'Design updates start from a minimum of £60. We recommend grouping any edits you need into a single request so you only pay once, rather than making small changes one at a time.',
  },
  {
    q: 'What if I want to migrate to another provider?',
    a: 'Your website belongs to you. If you decide to move to a different hosting provider, simply download your website files from your dashboard before cancelling, and take them with you — no lock-in, no friction.',
  },
];

const features = [
  {
    icon: <MousePointerClick className="w-6 h-6" />,
    title: 'Built to Convert',
    text: 'Every section is crafted with one goal in mind — turning visitors into customers. Clear calls-to-action, persuasive copy, and a layout that guides the eye.',
  },
  {
    icon: <Gauge className="w-6 h-6" />,
    title: 'Lightning Fast',
    text: 'Our landing pages load in under a second. Speed matters — visitors leave slow sites, and search engines penalise them.',
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: 'Perfectly Responsive',
    text: 'Your page looks flawless on every device — phone, tablet, laptop, or desktop. Over 60% of visitors browse on mobile, so we design mobile-first.',
  },
  {
    icon: <Search className="w-6 h-6" />,
    title: 'SEO Ready',
    text: 'Clean code, structured metadata, and semantic markup give your page the best possible start in search rankings.',
  },
  {
    icon: <Palette className="w-6 h-6" />,
    title: 'Custom Design',
    text: 'No templates, no cookie-cutter layouts. Your landing page is designed from scratch to match your brand and stand out from the competition.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Secure & Reliable',
    text: 'SSL encryption, daily backups, and 99.9% uptime. Your page is always safe, always online, always performing.',
  },
];

const steps = [
  {
    icon: <Search className="w-7 h-7" />,
    title: 'Discovery',
    text: 'We learn about your business, your audience, and what makes you different. This shapes every design decision that follows.',
  },
  {
    icon: <Palette className="w-7 h-7" />,
    title: 'Design',
    text: 'We craft a custom landing page that captures your brand and communicates your value proposition in seconds.',
  },
  {
    icon: <Rocket className="w-7 h-7" />,
    title: 'Launch',
    text: 'We deploy your page to our fast, secure hosting with your domain connected. You go live within days, not weeks.',
  },
];

function FAQItem({ item }: { item: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-base font-semibold text-slate-900 pr-4">
          {item.q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-60 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-sm text-slate-600 leading-relaxed pr-8">
          {item.a}
        </p>
      </div>
    </div>
  );
}

function SectionBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tracking-wide uppercase">
      {children}
    </span>
  );
}

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <Logo className="w-9 h-9" />
              <span className="text-lg font-bold text-slate-900">MyQuickHost</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollTo('features')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('why')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Why Landing Pages
              </button>
              <button
                onClick={() => scrollTo('process')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Process
              </button>
              <button
                onClick={() => scrollTo('faq')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                FAQ
              </button>
            </nav>
            <div className="hidden md:flex items-center gap-4">
              <a
                href="/#/login"
                className="text-sm font-semibold text-slate-900 hover:text-slate-700 transition-colors"
              >
                Sign in
              </a>
              <a
                href="/#/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => scrollTo('features')}
                className="block w-full text-left text-sm font-medium text-slate-600 py-2"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('why')}
                className="block w-full text-left text-sm font-medium text-slate-600 py-2"
              >
                Why Landing Pages
              </button>
              <button
                onClick={() => scrollTo('process')}
                className="block w-full text-left text-sm font-medium text-slate-600 py-2"
              >
                Process
              </button>
              <button
                onClick={() => scrollTo('faq')}
                className="block w-full text-left text-sm font-medium text-slate-600 py-2"
              >
                FAQ
              </button>
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
                <a
                  href="/#/login"
                  className="text-sm font-semibold text-slate-900 py-2"
                >
                  Sign in
                </a>
                <a
                  href="/#/login"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-30 pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute top-40 right-40 w-64 h-64 rounded-full bg-blue-100 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                  Now accepting new clients
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight">
                Landing pages that{' '}
                <span className="text-emerald-600">convert visitors</span>{' '}
                into customers
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
                We design and build fast, focused, single-page websites that
                turn clicks into customers. No bloated multi-page sites — just
                one beautifully crafted page that tells your story and drives
                action.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <a
                  href="/#/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                >
                  Get Your Landing Page
                  <ArrowRight className="w-5 h-5" />
                </a>
                <button
                  onClick={() => scrollTo('why')}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-300 text-slate-700 text-base font-semibold hover:bg-slate-50 transition-all"
                >
                  Learn More
                </button>
              </div>
              <div className="mt-10 flex items-center gap-6">
                <div className="flex -space-x-2">
                  {[
                    'https://images.pexels.com/photos/5920775/pexels-photo-5920775.jpeg?auto=compress&cs=tinysrgb&w=80&h=80',
                    'https://images.pexels.com/photos/4473356/pexels-photo-4473356.jpeg?auto=compress&cs=tinysrgb&w=80&h=80',
                    'https://images.pexels.com/photos/10375889/pexels-photo-10375889.jpeg?auto=compress&cs=tinysrgb&w=80&h=80',
                    'https://images.pexels.com/photos/7289739/pexels-photo-7289739.jpeg?auto=compress&cs=tinysrgb&w=80&h=80',
                  ].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-10 h-10 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-amber-400 fill-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Trusted by 50+ small businesses
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200">
                <img
                  src={HERO_IMG}
                  alt="A modern workspace showcasing website design"
                  className="w-full h-[420px] lg:h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/30 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl border border-slate-200 p-5 max-w-[240px] hidden sm:block">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">0.8s</p>
                    <p className="text-xs text-slate-500">Avg. load time</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 bg-white rounded-xl shadow-xl border border-slate-200 p-5 hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">98+</p>
                    <p className="text-xs text-slate-500">Lighthouse score</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-slate-900">50+</p>
              <p className="text-sm text-slate-500 mt-1">Pages launched</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">£250</p>
              <p className="text-sm text-slate-500 mt-1">Flat build fee</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">0.8s</p>
              <p className="text-sm text-slate-500 mt-1">Avg. load time</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">99.9%</p>
              <p className="text-sm text-slate-500 mt-1">Uptime guarantee</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <SectionBadge>
              <Star className="w-3.5 h-3.5" />
              What You Get
            </SectionBadge>
            <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Everything your business needs to stand out online
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Each landing page is built from the ground up with attention to
              every detail — from the first impression to the final
              call-to-action.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-7 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300 bg-white"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white mb-5 group-hover:bg-emerald-600 transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why landing pages */}
      <section id="why" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
                <img
                  src={WORKSPACE_IMG}
                  alt="A designer crafting a website on a computer"
                  className="w-full h-[400px] lg:h-[480px] object-cover"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <SectionBadge>
                <MousePointerClick className="w-3.5 h-3.5" />
                Why Landing Pages
              </SectionBadge>
              <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                One page. One message. One clear path to action.
              </h2>
              <p className="mt-5 text-lg text-slate-600 leading-relaxed">
                The way people browse the web has changed. Visitors scroll —
                they don't click. They want to understand what you offer and
                decide whether to act, all without navigating to a second page.
                A well-built landing page delivers exactly that.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  {
                    title: 'Scroll, don\'t click',
                    text: 'Modern visitors prefer to scroll through a single, well-structured page rather than hunt through menus and sub-pages. A landing page keeps everything in one place, guiding them naturally from headline to call-to-action.',
                  },
                  {
                    title: 'One focused goal',
                    text: 'Multi-page sites dilute attention. A landing page has a single purpose — whether that is capturing leads, booking calls, or selling a product — and every element serves that purpose.',
                  },
                  {
                    title: 'Faster decisions',
                    text: 'When visitors can see your full story in one scroll, they make decisions faster. No digging for contact details, no wondering where to go next — just a clear path from interest to action.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <SectionBadge>
              <Rocket className="w-3.5 h-3.5" />
              How It Works
            </SectionBadge>
            <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              From idea to launch in three simple steps
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              We keep the process straightforward so you can focus on running
              your business.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-full h-px border-t-2 border-dashed border-slate-200" />
                )}
                <div className="relative bg-white">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-6 mx-auto md:mx-0">
                    {step.icon}
                  </div>
                  <div className="absolute top-0 right-0 md:right-auto md:left-24 md:top-2 text-5xl font-bold text-slate-100 select-none">
                    0{i + 1}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <SectionBadge>
            <Star className="w-3.5 h-3.5" />
            Simple Pricing
          </SectionBadge>
          <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">
            Transparent pricing. No surprises.
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
            One flat fee to build your page, then a small monthly hosting cost.
            That is it.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-left">
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                Build
              </p>
              <p className="mt-3 text-5xl font-bold">
                £250
              </p>
              <p className="text-sm text-slate-400 mt-1">one-time</p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Custom landing page design
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Mobile-responsive build
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Domain setup included
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  SEO-ready foundation
                </li>
              </ul>
            </div>
            <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-left">
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                Hosting
              </p>
              <p className="mt-3 text-5xl font-bold">
                £12<span className="text-2xl text-slate-400 font-normal">/mo</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">billed monthly</p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Fast, secure hosting
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  SSL certificate included
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Daily backups
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Cancel anytime
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial / CTA banner */}
      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src={COLLAB_IMG}
              alt="Professionals collaborating in a modern office"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/80" />
            <div className="relative px-6 py-16 sm:px-12 sm:py-20 text-center">
              <div className="flex items-center justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
              <p className="text-xl sm:text-2xl font-medium text-white leading-relaxed max-w-2xl mx-auto">
                "Our landing page paid for itself in the first week. The team
                understood exactly what we needed and delivered a page that
                looks incredible and actually converts. Worth every penny."
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <img
                  src="https://images.pexels.com/photos/10375889/pexels-photo-10375889.jpeg?auto=compress&cs=tinysrgb&w=80&h=80"
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                />
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">
                    Sarah Mitchell
                  </p>
                  <p className="text-xs text-slate-400">
                    Owner, The Coffee Corner
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <SectionBadge>
              <Search className="w-3.5 h-3.5" />
              Questions & Answers
            </SectionBadge>
            <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Everything you need to know
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Still have questions? Get in touch and we will be happy to help.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 px-6 sm:px-8 shadow-sm">
            {faqs.map((item) => (
              <FAQItem key={item.q} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Ready to launch your landing page?
          </h2>
          <p className="mt-5 text-lg text-slate-600 max-w-xl mx-auto">
            Join the businesses that chose focus over clutter. Get a
            custom-built landing page that turns visitors into customers — for
            just £250.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
              Get Started Today
              <ArrowRight className="w-5 h-5" />
            </a>
            <button
              onClick={() => scrollTo('faq')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-300 text-slate-700 text-base font-semibold hover:bg-slate-50 transition-all"
            >
              Read FAQ
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Logo className="w-8 h-8" />
              <span className="text-base font-bold text-slate-900">
                MyQuickHost
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <button
                onClick={() => scrollTo('features')}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('why')}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Why Landing Pages
              </button>
              <button
                onClick={() => scrollTo('faq')}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                FAQ
              </button>
              <a
                href="/#/login"
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Client Portal
              </a>
            </nav>
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} MyQuickHost. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
