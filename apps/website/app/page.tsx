import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Eye,
  Github,
  Globe,
  Heart,
  Layers,
  LayoutDashboard,
  LineChart,
  Lock,
  Mail,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import Image from "next/image";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <LogoCloud />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DashboardPreview />
      <PricingSection />
      <OpenSourceSection />
      <CTASection />
      <Footer />
    </main>
  );
}

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BullLogo />
            <span className="text-sm font-semibold tracking-tight text-foreground leading-none">
              bullstudio
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="https://docs.bullstudio.dev"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              href="https://github.com/emirce/bullstudio"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Github className="size-4" />
              GitHub
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`${config.appUrl}/login`}
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href={`${config.appUrl}/signup`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all hover:shadow-md"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary/10 blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-primary/5 blur-[128px] animate-pulse" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
            <Sparkles className="size-4" />
            <span>Now in Public Beta</span>
            <ChevronRight className="size-4" />
          </div>

          {/* Main headline */}
          <h1 className="animate-fade-up animate-delay-100 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            <span className="text-foreground">Queue management</span>
            <br />
            <span className="text-gradient">that just works</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up animate-delay-200 mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The modern observability dashboard for BullMQ. Real-time monitoring,
            job management, and actionable alerts — all in one beautiful
            interface.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up animate-delay-300 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`${config.appUrl}/signup`}
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:shadow-xl hover:shadow-primary/20 glow-primary"
            >
              Start Free Trial
              <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-3.5 text-base font-semibold text-foreground hover:bg-card transition-all"
            >
              <Play className="size-5 text-primary" />
              Watch Demo
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="animate-fade-up animate-delay-400 mt-12 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              No credit card required
            </span>
            <span className="hidden sm:flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              5-minute setup
            </span>
            <span className="hidden md:flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Free tier available
            </span>
          </div>
        </div>

        {/* Hero image / Dashboard preview */}
        <div className="animate-scale-in animate-delay-500 mt-16 sm:mt-24 relative">
          <div className="relative mx-auto max-w-5xl">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-3xl opacity-50 rounded-3xl" />

            {/* Dashboard mockup */}
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/50">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500/80" />
                  <div className="size-3 rounded-full bg-yellow-500/80" />
                  <div className="size-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground font-mono">
                    app.bullstudio.dev
                  </div>
                </div>
              </div>
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoCloud() {
  return (
    <section className="relative py-16 border-y border-border/50 bg-card/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8">
          Built for modern Node.js stacks
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {[
            { name: "Node.js", icon: <Server className="size-5" /> },
            { name: "Redis", icon: <Cpu className="size-5" /> },
            { name: "TypeScript", icon: <Code2 className="size-5" /> },
            { name: "BullMQ", icon: <Layers className="size-5" /> },
            { name: "Docker", icon: <Server className="size-5" /> },
          ].map((tech) => (
            <div
              key={tech.name}
              className="flex items-center gap-2 text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              {tech.icon}
              <span className="text-sm font-medium">{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Managing queues shouldn&apos;t be{" "}
            <span className="text-destructive">painful</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            You know the drill. Jobs fail silently. Backlogs grow unnoticed.
            Debugging is a nightmare.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Eye className="size-6" />,
              title: "Zero visibility",
              description:
                "No idea what's happening in your queues until users start complaining. Flying blind in production.",
              color: "text-red-400",
            },
            {
              icon: <Clock className="size-6" />,
              title: "Hours wasted debugging",
              description:
                "Digging through logs, writing custom scripts, SSH-ing into servers. Time you could spend building.",
              color: "text-yellow-400",
            },
            {
              icon: <Bell className="size-6" />,
              title: "Alerts? What alerts?",
              description:
                "Finding out about failures from angry customers instead of proactive monitoring. Not ideal.",
              color: "text-orange-400",
            },
          ].map((problem, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-border transition-all hover:bg-card/80"
            >
              <div
                className={cn(
                  "inline-flex items-center justify-center size-12 rounded-xl bg-destructive/10 mb-4",
                  problem.color
                )}
              >
                {problem.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xl font-medium text-foreground mb-2">
            There&apos;s a better way.
          </p>
          <p className="text-muted-foreground">
            bullstudio gives you complete control over your BullMQ queues.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: <LayoutDashboard className="size-6" />,
      title: "Real-time Dashboard",
      description:
        "See your queue health at a glance. Throughput, latency, job states, worker status — everything updated in real-time.",
      color: "bg-blue-500/10 text-blue-400",
    },
    {
      icon: <Search className="size-6" />,
      title: "Job Inspector",
      description:
        "Drill down into any job. View payload, status, attempts, errors, and complete execution history.",
      color: "bg-purple-500/10 text-purple-400",
    },
    {
      icon: <RefreshCw className="size-6" />,
      title: "Retry & Manage",
      description:
        "Retry failed jobs with one click. Bulk operations, priority changes, and queue controls at your fingertips.",
      color: "bg-green-500/10 text-green-400",
    },
    {
      icon: <Bell className="size-6" />,
      title: "Smart Alerts",
      description:
        "Get notified before things go wrong. Backlog thresholds, failure rates, stalled workers — you define the rules.",
      color: "bg-yellow-500/10 text-yellow-400",
    },
    {
      icon: <LineChart className="size-6" />,
      title: "Metrics & Trends",
      description:
        "Historical data and trends to spot patterns. Identify bottlenecks and optimize your queue performance.",
      color: "bg-pink-500/10 text-pink-400",
    },
    {
      icon: <Globe className="size-6" />,
      title: "Multi-Environment",
      description:
        "Development, staging, production — manage all your environments from one dashboard. Easy switching, clear separation.",
      color: "bg-cyan-500/10 text-cyan-400",
    },
  ];

  return (
    <section id="features" className="relative py-24 sm:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-4">
            <Zap className="size-4" />
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need to{" "}
            <span className="text-gradient">master your queues</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful tools for solo developers and teams. No more guesswork.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-primary/30 transition-all hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5"
            >
              <div
                className={cn(
                  "inline-flex items-center justify-center size-12 rounded-xl mb-4",
                  feature.color
                )}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Connect your Redis",
      description:
        "Add your Redis connection string. We support Redis, Redis Cluster, and cloud providers like Upstash.",
      code: `// Add your connection
REDIS_URL=redis://localhost:6379`,
      icon: <Server className="size-5" />,
    },
    {
      step: "02",
      title: "See everything",
      description:
        "Instantly get visibility into all your queues. Real-time metrics, job inspection, and management tools.",
      code: `// Your dashboard is ready
// All queues discovered automatically`,
      icon: <Eye className="size-5" />,
    },
  ];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground mb-4">
            <Code2 className="size-4" />
            Integration
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Up and running in <span className="text-gradient">2 minutes</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No SDK to install. No agents to deploy. Just connect your Redis and go.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-border to-transparent -translate-x-4 z-0" />
              )}

              <div className="relative rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-border transition-all">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-bold text-primary/30">
                    {step.step}
                  </span>
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {step.icon}
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {step.description}
                </p>

                {/* Code block */}
                <div className="rounded-lg bg-background/80 border border-border/50 p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{step.code}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section id="demo" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            A dashboard you&apos;ll{" "}
            <span className="text-gradient">actually enjoy</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Clean, fast, and packed with the tools you need. No clutter.
          </p>
        </div>

        {/* Feature highlights grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            {
              icon: <BarChart3 className="size-5" />,
              label: "Real-time metrics",
            },
            { icon: <Trash2 className="size-5" />, label: "Bulk operations" },
            { icon: <Shield className="size-5" />, label: "Role-based access" },
            {
              icon: <Lock className="size-5" />,
              label: "End-to-end encryption",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4"
            >
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {item.icon}
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Dashboard screenshot area */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 blur-3xl opacity-50 rounded-3xl" />
          <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/50">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500/80" />
              </div>
            </div>
            <DetailedDashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const tiers = [
    {
      name: "Free",
      description: "Get started with basic queue monitoring",
      price: "Free",
      priceDetail: "forever",
      features: [
        "1 Workspace",
        "1 Connection",
        "Monitoring",
        "Job insights",
        "Analytics",
        "Basic support",
      ],
      cta: "Get Started",
      ctaVariant: "outline" as const,
      popular: false,
    },
    {
      name: "Pro",
      description: "For growing teams with advanced needs",
      price: "$39",
      priceDetail: "/month",
      features: [
        "5 Workspaces",
        "5 Connections",
        "Everything in Free",
        "Alerts",
        "Premium support",
      ],
      cta: "Start Free Trial",
      ctaVariant: "primary" as const,
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      price: "$99",
      priceDetail: "/month",
      features: [
        "10 Workspaces",
        "10 Connections",
        "Everything in Pro",
      ],
      cta: "Get Started",
      ctaVariant: "outline" as const,
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground mb-4">
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={cn(
                "relative rounded-2xl border p-8 transition-all",
                tier.popular
                  ? "border-primary bg-card shadow-xl shadow-primary/10 scale-105"
                  : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80"
              )}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Sparkles className="size-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1">{tier.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground ml-1">
                  {tier.priceDetail}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`${config.appUrl}/signup`}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                  tier.ctaVariant === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    : "border border-border bg-card hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {tier.cta}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include SSL encryption, 99.9% uptime SLA, and regular
          backups.
        </p>
      </div>
    </section>
  );
}

function OpenSourceSection() {
  return (
    <section className="relative py-24 sm:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 sm:p-12 lg:p-16 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-6">
                <Heart className="size-4" />
                Open Source
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Proudly <span className="text-gradient">Open Source</span>
              </h2>

              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                bullstudio is built in the open. Inspect our code, contribute
                features, or self-host for complete control. We believe in
                transparency and community-driven development.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="https://github.com/emirce/bullstudio"
                  className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Github className="size-5" />
                  View on GitHub
                </Link>
                <Link
                  href="https://github.com/emirce/bullstudio/bullstudio/stargazers"
                  className="inline-flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Sparkles className="size-5 text-yellow-500" />
                  Star the repo
                </Link>
              </div>
            </div>

            <div className="relative">
              {/* GitHub-style contribution graph mockup */}
              <div className="rounded-2xl border border-border/50 bg-card/80 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Contributions</span>
                  <span className="text-xs text-muted-foreground">
                    Last 12 months
                  </span>
                </div>
                <ContributionGraph />
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>Less</span>
                  <div className="flex gap-1">
                    <div className="size-3 rounded-sm bg-muted" />
                    <div className="size-3 rounded-sm bg-primary/20" />
                    <div className="size-3 rounded-sm bg-primary/50" />
                    <div className="size-3 rounded-sm bg-primary" />
                  </div>
                  <span>More</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContributionGraph() {
  // Pre-generated pattern for consistent rendering
  const pattern = [
    3, 1, 0, 2, 3, 1, 0, 2, 1, 3, 2, 0, 1, 2, 3, 0, 2, 1, 3, 0, 1, 2, 0, 3, 1,
    2, 0, 3, 2, 1, 0, 2, 3, 1, 2, 0, 3, 1, 2, 0, 1, 3, 2, 0, 3, 1, 2, 0, 1, 2,
    3, 0, 1, 2, 3, 1, 0, 2, 1, 3, 0, 2, 1, 3, 2, 0, 1, 2, 3, 0, 2, 1, 0, 3, 2,
    1, 0, 2, 3, 1, 2, 0, 3, 1,
  ];

  return (
    <div className="grid grid-cols-12 gap-1">
      {pattern.map((level, i) => (
        <div
          key={i}
          className={cn(
            "size-3 rounded-sm",
            level === 3
              ? "bg-primary"
              : level === 2
                ? "bg-primary/50"
                : level === 1
                  ? "bg-primary/20"
                  : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8 sm:p-12 lg:p-16 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />

          <div className="relative text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Ready to tame your queues?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of developers who trust bullstudio to keep their
              queues running smoothly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`${config.appUrl}/signup`}
                className="group inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:shadow-xl hover:shadow-primary/20"
              >
                Get Started Free
                <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href={`mailto:${config.supportEmail}`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-8 py-4 text-base font-semibold text-foreground hover:bg-card transition-all"
              >
                <Mail className="size-5" />
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <BullLogo />
              <span className="text-sm font-semibold tracking-tight">
                bullstudio
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Modern queue management for BullMQ. Built for developers.
            </p>
            <div className="flex gap-3">
              <Link
                href="https://github.com/emirce/bullstudio"
                className="size-9 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <Github className="size-4" />
              </Link>
              <Link
                href="https://x.com/emirce"
                className="size-9 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#features"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
              </li>
              {/* Hidden for now - will be added later */}
              {/* <li>
                <Link
                  href="/changelog"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  href="/roadmap"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Roadmap
                </Link>
              </li> */}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://docs.bullstudio.dev"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Documentation
                </Link>
              </li>
              {/* Hidden for now - will be added later */}
              {/* <li>
                <Link
                  href="/api-reference"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link
                  href="/guides"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Guides
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Blog
                </Link>
              </li> */}
            </ul>
          </div>

          <div className="hidden">
            <h4 className="text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {["About", "Contact", "Privacy", "Terms"].map((item) => (
                <li key={item}>
                  <Link
                    href={`/${item.toLowerCase()}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-border/50 gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} bullstudio. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Made with <Heart className="size-3 text-red-500 fill-red-500" /> for
            developers
          </p>
        </div>
      </div>
    </footer>
  );
}

// Components

function BullLogo() {
  return <Image src="/logo.svg" alt="bullstudio logo" width={32} height={32} />;
}

function DashboardMockup() {
  return (
    <div className="p-6 bg-background/50 min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <LayoutDashboard className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Overview</div>
            <div className="text-xs text-muted-foreground">Production</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium">
            All systems operational
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Jobs", value: "1.2M", change: "+12%" },
          { label: "Completed", value: "1.18M", change: "+15%" },
          { label: "Failed", value: "234", change: "-8%" },
          { label: "Active Workers", value: "12", change: "0%" },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/50 bg-card/50 p-4"
          >
            <div className="text-xs text-muted-foreground mb-1">
              {stat.label}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold">{stat.value}</span>
              <span
                className={cn(
                  "text-xs",
                  stat.change.startsWith("+")
                    ? "text-emerald-500"
                    : stat.change.startsWith("-")
                      ? "text-red-500"
                      : "text-muted-foreground"
                )}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <div className="text-sm font-medium mb-4">Job Throughput</div>
        <div className="h-32 flex items-end gap-1">
          {[
            85, 72, 90, 65, 78, 88, 95, 70, 82, 75, 92, 68, 80, 87, 73, 91, 77,
            84, 69, 93, 76, 89, 71, 86,
          ].map((height, i) => (
            <div key={i} className="flex-1 flex flex-col gap-0.5">
              <div
                className="bg-emerald-500/80 rounded-t"
                style={{ height: `${height * 0.9}%` }}
              />
              <div
                className="bg-red-500/80 rounded-b"
                style={{ height: `${height * 0.1}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailedDashboardMockup() {
  return (
    <div className="flex min-h-[500px]">
      {/* Sidebar */}
      <div className="w-56 border-r border-border/50 bg-card/30 p-4">
        <div className="flex items-center gap-2 mb-6">
          <BullLogo />
          <span className="text-sm font-semibold">bullstudio</span>
        </div>
        <nav className="space-y-1">
          {[
            {
              icon: <LayoutDashboard className="size-4" />,
              label: "Overview",
              active: true,
            },
            {
              icon: <Layers className="size-4" />,
              label: "Jobs",
              active: false,
            },
            {
              icon: <Bell className="size-4" />,
              label: "Alerts",
              active: false,
            },
            {
              icon: <Server className="size-4" />,
              label: "Connections",
              active: false,
            },
          ].map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 bg-background/50">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Processed", value: "48.2k", trend: "up" },
            { label: "Failed", value: "127", trend: "down" },
            { label: "Waiting", value: "3.4k", trend: "neutral" },
            { label: "Delayed", value: "891", trend: "neutral" },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/50 p-4"
            >
              <div className="text-xs text-muted-foreground mb-1">
                {stat.label}
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Queues table */}
        <div className="rounded-xl border border-border/50 bg-card/50">
          <div className="px-4 py-3 border-b border-border/50">
            <span className="text-sm font-medium">Active Queues</span>
          </div>
          <div className="divide-y divide-border/50">
            {[
              { name: "email-notifications", jobs: "12.4k", status: "healthy" },
              { name: "image-processing", jobs: "8.2k", status: "healthy" },
              { name: "payment-webhooks", jobs: "3.1k", status: "warning" },
              { name: "analytics-events", jobs: "24.8k", status: "healthy" },
            ].map((queue, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-2 rounded-full",
                      queue.status === "healthy"
                        ? "bg-emerald-500"
                        : "bg-yellow-500"
                    )}
                  />
                  <span className="text-sm font-mono">{queue.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {queue.jobs} jobs
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
