import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Shield, Users, BookOpen, Heart, ArrowRight, Phone, Mail } from "lucide-react";
import { Link } from "wouter";

const aboutData = {
  pageId: "about",
  title: "About Personal Credit Pros",
  hero: {
    eyebrow: "ARE BANKS TURNING YOU DOWN?",
    headline: "I Help You Get Your Credit Score Back on Track — Like a Clean Slate.",
    subheadline: "Using advanced credit repair strategies, I help you clean up your reports, rebuild your profile, and position you to get approved for the funding you need.",
    primaryCta: { label: "Fix My Credit Now", href: "/checkout" },
    secondaryCta: { label: "Book an Appointment", href: "/booking" }
  },
  whoWeHelp: {
    heading: "Who I Work With",
    body: [
      "If you've gone through a pay cut, job loss, a slowdown in your business, or you're simply feeling stuck because of your credit score, you're not alone.",
      "Many of my clients come to me after being turned down by banks, credit unions, and lenders. They're tired of rejections, worried about their families, and frustrated that their credit is holding them back from opportunities they deserve."
    ],
    bullets: [
      "You're nervous to apply for a mortgage, HELOC, auto loan, or business loan because of past denials.",
      "You've been declined for credit cards or loans and don't know what to fix first.",
      "You're being refused a home purchase because you can't get approved for a mortgage.",
      "You need capital to grow or stabilize your business but know you won't qualify under your current profile.",
      "You're struggling to access basic services and resources that move your life and career forward."
    ]
  },
  whyPartner: {
    heading: "Why You Need a Trustworthy Credit Partner",
    intro: "Credit repair isn't just about deleting a few items. It's about having the right partner guiding you from where you are now to the moment you're fully funded.",
    items: [
      { title: "Honest From Day One", description: "You get clear expectations, fair terms, and full transparency. There are no surprise charges or hidden fees.", icon: Heart },
      { title: "End-to-End Guidance", description: "I stay with you from the first analysis of your reports all the way until you're funded and on solid financial footing.", icon: Users },
      { title: "Education & Protection", description: "I explain the process, help you avoid common pitfalls, and make sure nothing is done that could hurt your profile or violate the law.", icon: BookOpen },
      { title: "Safe & Compliant", description: "Everything is done the right way, with a focus on long-term stability, legal compliance, and true credit restoration.", icon: Shield }
    ]
  },
  whatWeSee: {
    heading: "What I See Every Day",
    body: [
      "I've seen entire families under intense stress because the bank refused to approve a loan they desperately needed.",
      "I've watched people juggle multiple jobs just to keep up with a mortgage payment while bad credit forces them into outrageously high interest rates.",
      "I've seen clients pay hundreds of thousands of dollars in extra interest over a lifetime simply because their credit was never repaired properly.",
      "And I've seen relationships, careers, and mental health suffer — not because people were lazy or careless, but because life happened and they didn't have the right help at the right time.",
      "This is exactly why I built Personal Credit Pros: to be the partner that helps you turn this around and move forward without that constant financial pressure."
    ]
  },
  howIHelp: {
    heading: "What You Get When I Work on Your Behalf",
    intro: "My process is designed to reduce your stress, clean up your reports, rebuild your profile, and support you until you're funded.",
    steps: [
      { title: "Stress-Free Start", description: "I simplify everything. I review your situation, break it down in plain language, and handle the heavy lifting so you can breathe again." },
      { title: "Clean Slate Profile", description: "We work to remove outdated or inaccurate personal information so your reports are consistent and ready for serious lending decisions." },
      { title: "Derogatory Repair", description: "I challenge and work to remove derogatory and negative items that should not be holding your score down." },
      { title: "Strategic Credit Building", description: "We add and structure positive tradelines to strengthen your profile and help you qualify for better approvals faster." },
      { title: "Support Until You're Funded", description: "I stay with you throughout the process, helping you position for approvals on mortgages, HELOCs, auto loans, and business funding." },
      { title: "No Hidden Fees. Ever.", description: "You'll always know what you're paying for. No surprise charges, no junk fees, and no games." }
    ]
  },
  caseStudy: {
    heading: "Real Client Results",
    title: "Credit Score Increase & Business Funding in 90 Days",
    clientName: "Jarred Starman",
    subtitle: "Business entrepreneur – +155 point score increase, $30,000 in business funding, and a new construction home.",
    story: [
      "Jarred came in with a 605 credit score, over 30 recent inquiries, high utilization, and inaccurate derogatory items after being turned down for multiple mortgages and business funding opportunities.",
      "Using Credit Care Connect AI and a customized Credit Resolution Plan, we worked to remove dozens of inquiries, clean up inaccurate negative items, and systematically repair his profile.",
      "Within about 90 days, his score increased by over 155 points. He secured approximately $30,000 in business capital, paid down high-interest credit card debt, and purchased a newly constructed home in Naples, FL."
    ]
  },
  founder: {
    heading: "Meet Your Credit Repair Specialist",
    body: [
      "My name is Jarred Starman, and I've spent several years helping people all over the United States rebuild their credit and secure funding.",
      "I've helped clients get approved for home loans, real estate investor loans, personal loans, and business funding — often after they were told 'no' by traditional lenders.",
      "Along the way, I've worked with major banks and credit unions, helped clients budget more effectively, and coached them on how to protect and grow their credit for the long term.",
      "I know what it feels like to be under financial pressure, and I know exactly how to map a path out of it. My commitment is simple: deliver real results, with full transparency, and never jeopardize your trust."
    ],
    values: [
      "I will never waste your time.",
      "I will never hit you with hidden fees.",
      "You will always get 100% transparency.",
      "The goal is always the best result the market will allow."
    ]
  },
  worthIt: {
    heading: "What Is a Clean Financial Future Worth to You?",
    body: [
      "Imagine being able to secure the funding your family needs, qualify for better rates, and finally move toward the home, vehicle, or business you've been working so hard for.",
      "Imagine consolidating debt, improving your credit score, and not waking up at night worried about whether you'll be approved the next time you apply.",
      "That peace of mind alone is priceless — and it starts with one simple step: a conversation about where you are now and where you want to be."
    ]
  },
  ctaSection: {
    heading: "Ready to Fix Your Credit and Move Forward?",
    body: "If you're serious about improving your credit and getting funded, I'd love to talk with you, look at your situation, and map out a plan tailored specifically to you.",
    primaryCta: { label: "Fix My Credit Now", href: "/checkout" },
    secondaryCta: { label: "Request a Free Consultation", href: "/booking" }
  }
};

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Simple Header for Public Page */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Personal Credit Pros</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-blue-200 font-semibold tracking-wide uppercase mb-4" data-testid="hero-eyebrow">
            {aboutData.hero.eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight" data-testid="hero-headline">
            {aboutData.hero.headline}
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto" data-testid="hero-subheadline">
            {aboutData.hero.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8" asChild>
              <a href={aboutData.hero.primaryCta.href} data-testid="hero-primary-cta">
                {aboutData.hero.primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
              <a href={aboutData.hero.secondaryCta.href} data-testid="hero-secondary-cta">
                {aboutData.hero.secondaryCta.label}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Who We Help */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-who-we-help">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-slate-900 dark:text-white">
            {aboutData.whoWeHelp.heading}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {aboutData.whoWeHelp.body.map((para, i) => (
                <p key={i} className="text-lg text-slate-600 dark:text-slate-300">{para}</p>
              ))}
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6">
              <ul className="space-y-3">
                {aboutData.whoWeHelp.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Partner With Us */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-800/50" data-testid="section-why-partner">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900 dark:text-white">
            {aboutData.whyPartner.heading}
          </h2>
          <p className="text-lg text-center text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto">
            {aboutData.whyPartner.intro}
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aboutData.whyPartner.items.map((item, i) => (
              <Card key={i} className="text-center border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What We See */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-what-we-see">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-slate-900 dark:text-white">
            {aboutData.whatWeSee.heading}
          </h2>
          <div className="space-y-4">
            {aboutData.whatWeSee.body.map((para, i) => (
              <p key={i} className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* How I Help - Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900" data-testid="section-how-i-help">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900 dark:text-white">
            {aboutData.howIHelp.heading}
          </h2>
          <p className="text-lg text-center text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto">
            {aboutData.howIHelp.intro}
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aboutData.howIHelp.steps.map((step, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Study */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-case-study">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-900 dark:text-white">
            {aboutData.caseStudy.heading}
          </h2>
          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-blue-50 dark:from-slate-800 dark:to-slate-700">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  +155
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{aboutData.caseStudy.title}</h3>
                  <p className="text-green-600 dark:text-green-400 font-medium">{aboutData.caseStudy.clientName}</p>
                </div>
              </div>
              <p className="text-lg text-slate-700 dark:text-slate-300 mb-6 font-medium">
                {aboutData.caseStudy.subtitle}
              </p>
              <div className="space-y-4">
                {aboutData.caseStudy.story.map((para, i) => (
                  <p key={i} className="text-slate-600 dark:text-slate-400">{para}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* About Founder */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-800/50" data-testid="section-founder">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-slate-900 dark:text-white">
            {aboutData.founder.heading}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {aboutData.founder.body.map((para, i) => (
                <p key={i} className="text-lg text-slate-600 dark:text-slate-300">{para}</p>
              ))}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <h3 className="font-semibold text-lg mb-4 text-slate-900 dark:text-white">My Commitment to You:</h3>
              <ul className="space-y-3">
                {aboutData.founder.values.map((value, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What It's Worth */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-worth">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-900 dark:text-white">
            {aboutData.worthIt.heading}
          </h2>
          <div className="space-y-4">
            {aboutData.worthIt.body.map((para, i) => (
              <p key={i} className="text-lg text-slate-600 dark:text-slate-300">{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-800 text-white" data-testid="section-cta">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {aboutData.ctaSection.heading}
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            {aboutData.ctaSection.body}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8" asChild>
              <a href={aboutData.ctaSection.primaryCta.href} data-testid="cta-primary">
                {aboutData.ctaSection.primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
              <a href={aboutData.ctaSection.secondaryCta.href} data-testid="cta-secondary">
                {aboutData.ctaSection.secondaryCta.label}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold mb-2">Your Personal 1-on-1 Credit Repair Specialist</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Site Links</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="/booking" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/checkout" className="hover:text-white transition-colors">Fix My Credit</a></li>
                <li><a href="/booking" className="hover:text-white transition-colors">Request A Free Consultation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a href="tel:+12398887959" className="hover:text-white transition-colors">239-888-7959</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href="mailto:jarred@anunlimitedllc.com" className="hover:text-white transition-colors">jarred@anunlimitedllc.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-slate-400 text-sm">
            <p>Powered by Credit Care Connect AI</p>
            <p className="mt-2">Copyright © 2025 Personal Credit Pros</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
