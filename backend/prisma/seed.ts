// Demo data for local development: four users, nine jobs and six
// applications, with Bosnian text as in real use. Every demo user signs in
// with the password below.
//
// Run it with `npx prisma db seed`. It upserts fixed IDs, so a second run
// changes nothing, and it never deletes data.
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  ApplicationStatus,
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../src/generated/prisma/enums';

const DEMO_PASSWORD = 'demo-password-123';
const HOUR_MS = 60 * 60 * 1000;

const users = [
  { id: 'seed-user-amra', email: 'amra@example.com', fullName: 'Amra Hodžić' },
  {
    id: 'seed-user-kenan',
    email: 'kenan@example.com',
    fullName: 'Kenan Mehić',
  },
  {
    id: 'seed-user-lejla',
    email: 'lejla@example.com',
    fullName: 'Lejla Begić',
  },
  {
    id: 'seed-user-tarik',
    email: 'tarik@example.com',
    fullName: 'Tarik Selimović',
  },
];

// hoursAgo spreads the jobs over the last few days, newest first. Prices
// are whole KM, and null means the price is agreed later.
const listings: {
  id: string;
  clientId: string;
  title: string;
  category: ListingCategory;
  location: ListingLocation;
  status?: ListingStatus;
  budget: number | null;
  description: string;
  hoursAgo: number;
}[] = [
  {
    id: 'seed-listing-lawn',
    clientId: 'seed-user-amra',
    title: 'Košenje dvorišta i orezivanje živice',
    category: ListingCategory.LAWN_MOWING,
    location: ListingLocation.ILIDZA,
    budget: 60,
    description:
      'Dvorište od oko 400 m² i živica uz ogradu. Imam kosilicu, potrebna je samo pomoć oko košenja i odvoza trave.',
    hoursAgo: 3,
  },
  {
    id: 'seed-listing-move',
    clientId: 'seed-user-amra',
    title: 'Pomoć pri selidbi dvosobnog stana',
    category: ListingCategory.MOVING,
    location: ListingLocation.SARAJEVO,
    budget: 150,
    description:
      'Selim se sa Grbavice na Stup u subotu ujutro. Treba mi dvoje ljudi za nošenje namještaja, kombi imam.',
    hoursAgo: 7,
  },
  {
    id: 'seed-listing-laptop',
    clientId: 'seed-user-amra',
    title: 'Reinstalacija Windowsa i prenos podataka',
    category: ListingCategory.IT_HELP,
    location: ListingLocation.SARAJEVO,
    budget: 40,
    description:
      'Laptop je usporio. Treba mi čista instalacija, prebacivanje slika i dokumenata i podešavanje printera.',
    hoursAgo: 20,
  },
  {
    id: 'seed-listing-car',
    clientId: 'seed-user-lejla',
    title: 'Detaljno pranje i usisavanje auta',
    category: ListingCategory.CAR_WASH,
    location: ListingLocation.VOGOSCA,
    budget: 35,
    description:
      'Golf 7, unutrašnjost i vanjski dio. Može kod mene ispred zgrade, struja i voda dostupni.',
    hoursAgo: 5,
  },
  {
    id: 'seed-listing-cleaning',
    clientId: 'seed-user-lejla',
    title: 'Generalno čišćenje stana nakon renoviranja',
    category: ListingCategory.CLEANING,
    location: ListingLocation.MOSTAR,
    budget: 120,
    description:
      'Stan od 70 m², prašina od krečenja i ostaci boje na podu. Sredstva za čišćenje obezbjeđujem.',
    hoursAgo: 26,
  },
  {
    id: 'seed-listing-wardrobe',
    clientId: 'seed-user-tarik',
    title: 'Montaža IKEA ormara i dvije police',
    category: ListingCategory.ASSEMBLY,
    location: ListingLocation.BANJA_LUKA,
    // Its application was accepted, so the client closed it.
    status: ListingStatus.CLOSED,
    budget: 50,
    description:
      'Ormar PAX 200 cm i dvije zidne police. Potrebna bušilica za montažu na zid.',
    hoursAgo: 30,
  },
  {
    id: 'seed-listing-groceries',
    clientId: 'seed-user-tarik',
    title: 'Dostava namirnica starijoj osobi dva puta sedmično',
    category: ListingCategory.DELIVERY,
    location: ListingLocation.TUZLA,
    budget: 25,
    description:
      'Tražim pouzdanu osobu za kupovinu i dostavu namirnica utorkom i petkom popodne. Cijena je po dostavi.',
    hoursAgo: 48,
  },
  {
    id: 'seed-listing-lunch',
    clientId: 'seed-user-lejla',
    title: 'Kuhanje ručka za porodično okupljanje',
    category: ListingCategory.OTHER,
    location: ListingLocation.ZENICA,
    budget: null,
    description:
      'Ručak za 15 osoba, tradicionalna jela. Termin je sljedeća subota.',
    hoursAgo: 60,
  },
  {
    id: 'seed-listing-tv',
    clientId: 'seed-user-tarik',
    title: 'Montaža TV-a na zid i sređivanje kablova',
    category: ListingCategory.ASSEMBLY,
    location: ListingLocation.SARAJEVO,
    budget: 45,
    description: 'TV 55", nosač imam. Kablove bih sakrio u kanalicu.',
    hoursAgo: 72,
  },
];

const applications = [
  {
    id: 'seed-application-move-kenan',
    listingId: 'seed-listing-move',
    executorId: 'seed-user-kenan',
    message:
      'Imam iskustva sa selidbama, mogu dovesti još jednog čovjeka. Subota ujutro mi odgovara.',
    proposedPrice: 140,
    status: ApplicationStatus.PENDING,
    hoursAgo: 2,
  },
  {
    id: 'seed-application-move-tarik',
    listingId: 'seed-listing-move',
    executorId: 'seed-user-tarik',
    message:
      'Slobodan sam u subotu od 8h. Mogu pomoći i oko rastavljanja kreveta.',
    proposedPrice: null,
    status: ApplicationStatus.PENDING,
    hoursAgo: 4,
  },
  {
    id: 'seed-application-lawn-kenan',
    listingId: 'seed-listing-lawn',
    executorId: 'seed-user-kenan',
    message: 'Mogu doći već sutra poslijepodne, imam svoj trimer za živicu.',
    proposedPrice: 60,
    status: ApplicationStatus.ACCEPTED,
    hoursAgo: 1,
  },
  {
    id: 'seed-application-laptop-lejla',
    listingId: 'seed-listing-laptop',
    executorId: 'seed-user-lejla',
    message:
      'Radim servis računara pet godina. Prenos podataka je uključen u cijenu.',
    proposedPrice: 35,
    status: ApplicationStatus.REJECTED,
    hoursAgo: 10,
  },
  {
    id: 'seed-application-car-amra',
    listingId: 'seed-listing-car',
    executorId: 'seed-user-amra',
    message: 'Mogu u nedjelju prijepodne, donosim svoja sredstva i usisivač.',
    proposedPrice: 35,
    status: ApplicationStatus.PENDING,
    hoursAgo: 3,
  },
  {
    id: 'seed-application-wardrobe-amra',
    listingId: 'seed-listing-wardrobe',
    executorId: 'seed-user-amra',
    message: 'Sklapala sam PAX ormare više puta, imam bušilicu i tiple.',
    proposedPrice: 50,
    status: ApplicationStatus.ACCEPTED,
    hoursAgo: 20,
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must not run in production.');
  }

  // `prisma db seed` passes on the variables from prisma.config.ts; a direct
  // run reads .env itself.
  if (existsSync('.env')) process.loadEnvFile('.env');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const now = Date.now();
  const hoursAgo = (hours: number) => new Date(now - hours * HOUR_MS);

  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          ...user,
          passwordHash,
          emailVerifiedAt: hoursAgo(30 * 24),
          createdAt: hoursAgo(30 * 24),
        },
      });
    }

    for (const { hoursAgo: age, ...listing } of listings) {
      await prisma.listing.upsert({
        where: { id: listing.id },
        update: {},
        create: { ...listing, createdAt: hoursAgo(age) },
      });
    }

    for (const { hoursAgo: age, ...application } of applications) {
      await prisma.application.upsert({
        where: { id: application.id },
        update: {},
        create: { ...application, createdAt: hoursAgo(age) },
      });
    }

    console.log(
      `Seeded ${users.length} users, ${listings.length} jobs and ${applications.length} applications.`,
    );
    console.log(`Sign in as amra@example.com with ${DEMO_PASSWORD}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
