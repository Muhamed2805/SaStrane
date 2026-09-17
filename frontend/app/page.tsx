import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Code2,
  Hammer,
  HeartHandshake,
  Leaf,
  MapPinCheck,
  PackageCheck,
  Paintbrush,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { HeroSearch } from '@/features/landing/components/hero-search';
import { LatestListings } from '@/features/landing/components/latest-listings';

const categories = [
  { label: 'Košenje trave', icon: Leaf },
  { label: 'Pranje auta', icon: Car },
  { label: 'Selidbe', icon: Truck },
  { label: 'IT pomoć', icon: Code2 },
  { label: 'Čišćenje', icon: Sparkles },
  { label: 'Montaža', icon: Hammer },
  { label: 'Dostava', icon: PackageCheck },
  { label: 'Ostalo', icon: Paintbrush },
];

const trustPoints = [
  {
    icon: BadgeCheck,
    title: 'Jednostavna prijava',
    description: 'Pošalji ponudu direktno kroz oglas u nekoliko koraka.',
  },
  {
    icon: MapPinCheck,
    title: 'Lokalne prilike',
    description: 'Pronađi posao ili pomoć u svom gradu i neposrednoj blizini.',
  },
  {
    icon: ShieldCheck,
    title: 'Kontrola u tvojim rukama',
    description: 'Pregledaj detalje i samostalno odaberi najbolju ponudu.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-24 pb-4 sm:space-y-28">
      <section className="grid items-center gap-12 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <HeartHandshake className="size-4" aria-hidden="true" />
            Lokalni poslovi. Stvarni ljudi.
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Pronađi pomoć ili posao u{' '}
            <span className="text-primary">svom gradu</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Objavi posao koji treba završiti ili pronađi priliku za dodatnu
            zaradu — brzo, jednostavno i lokalno.
          </p>

          <HeroSearch />

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-5 border-t pt-6">
            <div>
              <div className="text-xl font-bold text-primary">8</div>
              <div className="mt-1 text-xs text-muted-foreground">
                kategorija usluga
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-primary">8</div>
              <div className="mt-1 text-xs text-muted-foreground">
                dostupnih lokacija
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-primary">0 KM</div>
              <div className="mt-1 text-xs text-muted-foreground">
                za objavu oglasa
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] shadow-2xl shadow-slate-900/15 sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src="/images/hero-services.webp"
              alt="Dvoje izvođača zajedno sastavljaju policu u domu"
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 42vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-xl border bg-white p-4 shadow-xl sm:left-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="text-sm font-semibold">Posao dogovoren</div>
              <div className="text-xs text-muted-foreground">
                Brzo i bez komplikacija
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-heading">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">
            Sve na jednom mjestu
          </p>
          <h2
            id="categories-heading"
            className="mt-2 text-3xl font-bold tracking-tight"
          >
            Istraži kategorije usluga
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Od sitnih kućnih poslova do stručne pomoći — pronađi ono što ti
            treba ili ponudi svoje vještine.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map(({ label, icon: Icon }) => (
            <Link
              key={label}
              href={`/listings?category=${encodeURIComponent(label)}`}
              className="group flex min-h-32 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-3 text-xs font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="latest-heading">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-primary">Nove prilike</p>
            <h2
              id="latest-heading"
              className="mt-2 text-3xl font-bold tracking-tight"
            >
              Najnoviji oglasi i zadaci
            </h2>
          </div>
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Pogledaj sve oglase
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <LatestListings />
      </section>

      <section id="kako-funkcionise" className="scroll-mt-24">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">
            Jednostavan proces
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Kako funkcioniše platforma
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border bg-[#fffaf1] p-7 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange-dark">
                <BriefcaseBusiness className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange-dark">
                  Trebaš pomoć?
                </p>
                <h3 className="text-xl font-bold">Za klijente</h3>
              </div>
            </div>
            <ol className="mt-7 space-y-5">
              {[
                'Objavi posao i opiši šta ti je potrebno.',
                'Pregledaj prijave zainteresovanih izvođača.',
                'Odaberi ponudu koja ti najviše odgovara.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link
              href="/listings/create"
              className="mt-7 inline-flex items-center gap-1 text-sm font-semibold text-brand-orange-dark"
            >
              Objavi posao <ChevronRight className="size-4" />
            </Link>
          </article>

          <article className="rounded-2xl border bg-primary/[0.06] p-7 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CircleDollarSign className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Želiš zaraditi?
                </p>
                <h3 className="text-xl font-bold">Za izvođače</h3>
              </div>
            </div>
            <ol className="mt-7 space-y-5">
              {[
                'Pronađi posao prema lokaciji i vještinama.',
                'Pošalji poruku i predloži svoju cijenu.',
                'Prati status svih prijava na jednom mjestu.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link
              href="/listings"
              className="mt-7 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Pronađi posao <ChevronRight className="size-4" />
            </Link>
          </article>
        </div>
      </section>

      <section>
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">
            Napravljeno za zajednicu
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Povezivanje zasnovano na povjerenju
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {trustPoints.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-xl border bg-white p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 sm:py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Želiš zaraditi dodatno radeći ono što voliš?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
              Pregledaj otvorene poslove u blizini i pošalji svoju prvu prijavu
              već danas.
            </p>
          </div>
          <Link
            href="/listings"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark"
          >
            Pronađi posao
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
