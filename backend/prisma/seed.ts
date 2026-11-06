// Demo data for local development: four users and an admin, ten jobs,
// seven photos, seven applications, two ratings, three conversations and
// one open report, with Bosnian text as in real use. Every demo user signs
// in with the password below.
//
// Run it with `npx prisma db seed`. It upserts fixed IDs, so a second run
// changes nothing, and it never deletes data. It only fills a demo user's
// empty introduction, skills and location, for databases seeded before
// those existed. The photos need the storage
// from docker-compose.yml and `npm run storage:init`; without it, the seed
// skips them.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { validateStorage } from '../src/config/environment.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  ApplicationStatus,
  ListingCategory,
  ListingLocation,
  ListingStatus,
  ReportReason,
} from '../src/generated/prisma/enums.js';
import { processPhoto } from '../src/listings/photos/photo-image.js';
import { photoKeys } from '../src/listings/photos/photo-keys.js';
import { createS3Client, IMMUTABLE_CACHE } from '../src/storage/s3-client.js';

const DEMO_PASSWORD = 'demo-password-123';
const HOUR_MS = 60 * 60 * 1000;

const users = [
  {
    id: 'seed-user-amra',
    email: 'amra@example.com',
    fullName: 'Amra Hodžić',
    bio: 'Sklapam namještaj i pomažem oko sitnih popravki u kući.',
    skills: [ListingCategory.ASSEMBLY, ListingCategory.OTHER],
    location: ListingLocation.ILIDZA,
  },
  {
    id: 'seed-user-kenan',
    email: 'kenan@example.com',
    fullName: 'Kenan Mehić',
    bio: 'Student informatike. Popravljam računare, postavljam mreže i pomažem oko selidbi vikendom.',
    skills: [ListingCategory.IT_HELP, ListingCategory.MOVING],
    location: ListingLocation.SARAJEVO,
  },
  {
    id: 'seed-user-lejla',
    email: 'lejla@example.com',
    fullName: 'Lejla Begić',
    bio: 'Čistim stanove i poslovne prostore. Imam svoja sredstva i usisivač.',
    skills: [ListingCategory.CLEANING, ListingCategory.CAR_WASH],
    location: ListingLocation.MOSTAR,
  },
  {
    id: 'seed-user-tarik',
    email: 'tarik@example.com',
    fullName: 'Tarik Selimović',
    bio: 'Imam svoj alat i kombi. Montiram namještaj, kosim travu i vozim manje terete po Sarajevu.',
    skills: [
      ListingCategory.ASSEMBLY,
      ListingCategory.LAWN_MOWING,
      ListingCategory.DELIVERY,
    ],
    location: ListingLocation.SARAJEVO,
  },
  // Handles reports on /admin.
  {
    id: 'seed-user-admin',
    email: 'admin@example.com',
    fullName: 'Moderator SaStrane',
    isAdmin: true,
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
  {
    id: 'seed-listing-fence',
    clientId: 'seed-user-lejla',
    title: 'Farbanje drvene ograde u dvorištu',
    category: ListingCategory.OTHER,
    location: ListingLocation.ILIDZA,
    // Done and rated, so the executor has a rating on his profile.
    status: ListingStatus.CLOSED,
    budget: 80,
    description:
      'Ograda je duga oko 25 metara. Boju i četke kupujem ja, treba samo rad.',
    hoursAgo: 240,
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
  {
    id: 'seed-application-fence-kenan',
    listingId: 'seed-listing-fence',
    executorId: 'seed-user-kenan',
    message: 'Farbao sam ograde i kapije, mogu završiti za jedan dan.',
    proposedPrice: 80,
    status: ApplicationStatus.ACCEPTED,
    hoursAgo: 230,
  },
];

// Photos from prisma/seed-photos, listed in SOURCES.md there. A job's
// first photo is its cover.
const photos = [
  {
    id: 'seed-photo-lawn-1',
    listingId: 'seed-listing-lawn',
    file: 'lawn-1.jpg',
  },
  {
    id: 'seed-photo-lawn-2',
    listingId: 'seed-listing-lawn',
    file: 'lawn-2.jpg',
  },
  {
    id: 'seed-photo-lawn-3',
    listingId: 'seed-listing-lawn',
    file: 'lawn-3.jpg',
  },
  { id: 'seed-photo-car', listingId: 'seed-listing-car', file: 'car.jpg' },
  {
    id: 'seed-photo-cleaning',
    listingId: 'seed-listing-cleaning',
    file: 'cleaning.jpg',
  },
  {
    id: 'seed-photo-fence',
    listingId: 'seed-listing-fence',
    file: 'fence.jpg',
  },
  { id: 'seed-photo-tv', listingId: 'seed-listing-tv', file: 'tv.jpg' },
];

// Ratings for accepted applications on closed jobs. The lawn job is still
// open, so Amra can close it and rate Kenan herself.
const ratings = [
  {
    id: 'seed-rating-wardrobe-amra',
    applicationId: 'seed-application-wardrobe-amra',
    listingId: 'seed-listing-wardrobe',
    listingTitle: 'Montaža IKEA ormara i dvije police',
    clientId: 'seed-user-tarik',
    executorId: 'seed-user-amra',
    score: 5,
    comment: 'Ormar i police montirani za dva sata, sve uredno počišćeno.',
    hoursAgo: 4,
  },
  {
    id: 'seed-rating-fence-kenan',
    applicationId: 'seed-application-fence-kenan',
    listingId: 'seed-listing-fence',
    listingTitle: 'Farbanje drvene ograde u dvorištu',
    clientId: 'seed-user-lejla',
    executorId: 'seed-user-kenan',
    score: 4,
    comment: 'Dobro urađeno. Kasnio je pola sata, ali se javio na vrijeme.',
    hoursAgo: 200,
  },
];

// Each conversation is between a job's client and the executor. The
// messages are oldest first; minutesAgo is when each one was sent.
const conversations: {
  id: string;
  listingId: string;
  clientId: string;
  executorId: string;
  messages: { fromClient: boolean; body: string; minutesAgo: number }[];
}[] = [
  {
    id: 'seed-conversation-lawn-kenan',
    listingId: 'seed-listing-lawn',
    clientId: 'seed-user-amra',
    executorId: 'seed-user-kenan',
    messages: [
      {
        fromClient: false,
        body: 'Dobar dan! Da li je kosilica benzinska ili električna? Da znam trebam li ponijeti produžni kabl.',
        minutesAgo: 50,
      },
      {
        fromClient: true,
        body: 'Benzinska je, gorivo imam. Može li sutra oko 15h?',
        minutesAgo: 45,
      },
      {
        fromClient: false,
        body: 'Može, vidimo se sutra u 15h. Ponijeću i trimer za živicu.',
        minutesAgo: 40,
      },
    ],
  },
  {
    id: 'seed-conversation-move-tarik',
    listingId: 'seed-listing-move',
    clientId: 'seed-user-amra',
    executorId: 'seed-user-tarik',
    messages: [
      {
        fromClient: false,
        body: 'Koliko je otprilike kutija i ima li lift u zgradi?',
        minutesAgo: 180,
      },
      {
        fromClient: true,
        body: 'Oko 20 kutija. Lift ima samo na Grbavici, na Stupu je drugi sprat.',
        minutesAgo: 150,
      },
    ],
  },
  {
    id: 'seed-conversation-car-amra',
    listingId: 'seed-listing-car',
    clientId: 'seed-user-lejla',
    executorId: 'seed-user-amra',
    messages: [
      {
        fromClient: false,
        body: 'Je li u redu ako dođem u nedjelju u 10h?',
        minutesAgo: 120,
      },
    ],
  },
];

// Uploads the photos that are not in the database yet, as the API would.
// Returns how many it added, or null when the storage is not reachable.
async function seedPhotos(prisma: PrismaClient): Promise<number | null> {
  const seeded = await prisma.listingPhoto.findMany({
    where: { id: { in: photos.map((photo) => photo.id) } },
    select: { id: true },
  });
  const done = new Set(seeded.map((photo) => photo.id));
  const missing = photos.filter((photo) => !done.has(photo.id));
  if (missing.length === 0) return 0;

  const storage = validateStorage(process.env, false);
  const client = createS3Client(storage);
  const Bucket = storage.S3_BUCKET;
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket }));
    } catch {
      return null;
    }

    for (const photo of missing) {
      const input = await readFile(
        new URL(`seed-photos/${photo.file}`, import.meta.url),
      );
      const { large, thumbnail } = await processPhoto(input);
      const keys = photoKeys(photo.listingId, photo.id);
      for (const [Key, Body] of [
        [keys.large, large.data],
        [keys.thumbnail, thumbnail],
      ] as const) {
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key,
            Body,
            ContentType: 'image/webp',
            CacheControl: IMMUTABLE_CACHE,
          }),
        );
      }
      await prisma.listingPhoto.create({
        data: {
          id: photo.id,
          listingId: photo.listingId,
          position: photos
            .filter((other) => other.listingId === photo.listingId)
            .indexOf(photo),
          width: large.width,
          height: large.height,
        },
      });
    }
    return missing.length;
  } finally {
    client.destroy();
  }
}

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
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

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
      // Only empty fields, so changes made in the app stay.
      const { email, bio, skills, location } = user;
      if (bio) {
        await prisma.user.updateMany({
          where: { email, bio: null },
          data: { bio },
        });
      }
      if (skills) {
        await prisma.user.updateMany({
          where: { email, skills: { isEmpty: true } },
          data: { skills },
        });
      }
      if (location) {
        await prisma.user.updateMany({
          where: { email, location: null },
          data: { location },
        });
      }
    }

    for (const { hoursAgo: age, ...listing } of listings) {
      await prisma.listing.upsert({
        where: { id: listing.id },
        update: {},
        create: { ...listing, createdAt: hoursAgo(age) },
      });
    }

    const addedPhotos = await seedPhotos(prisma);
    if (addedPhotos === null) {
      console.warn(
        'Skipped the photos: the storage is not reachable. Run `docker compose up -d` and `npm run storage:init`, then seed again.',
      );
    }

    for (const { hoursAgo: age, ...application } of applications) {
      await prisma.application.upsert({
        where: { id: application.id },
        update: {},
        create: { ...application, createdAt: hoursAgo(age) },
      });
    }

    for (const { hoursAgo: age, ...rating } of ratings) {
      await prisma.rating.upsert({
        where: { id: rating.id },
        update: {},
        create: { ...rating, createdAt: hoursAgo(age) },
      });
    }

    for (const { messages, ...conversation } of conversations) {
      await prisma.conversation.upsert({
        where: { id: conversation.id },
        update: {},
        create: {
          ...conversation,
          createdAt: minutesAgo(messages[0].minutesAgo),
        },
      });
      for (const [index, message] of messages.entries()) {
        await prisma.message.upsert({
          where: { id: `${conversation.id}-${index + 1}` },
          update: {},
          create: {
            id: `${conversation.id}-${index + 1}`,
            conversationId: conversation.id,
            senderId: message.fromClient
              ? conversation.clientId
              : conversation.executorId,
            body: message.body,
            createdAt: minutesAgo(message.minutesAgo),
          },
        });
      }
      // The receiver of the last message has not read it yet. Only a new
      // conversation is updated, so a second run keeps what was read.
      const last = messages[messages.length - 1];
      await prisma.conversation.updateMany({
        where: { id: conversation.id, lastMessageId: null },
        data: {
          lastMessageId: `${conversation.id}-${messages.length}`,
          lastMessageAt: minutesAgo(last.minutesAgo),
          clientUnread: last.fromClient ? 0 : 1,
          executorUnread: last.fromClient ? 1 : 0,
        },
      });
    }

    // Kenan reports a job, so the admin page has something to show.
    await prisma.report.upsert({
      where: { id: 'seed-report-tv' },
      update: {},
      create: {
        id: 'seed-report-tv',
        reporterId: 'seed-user-kenan',
        reportedUserId: 'seed-user-tarik',
        listingId: 'seed-listing-tv',
        listingTitle: 'Montaža TV-a na zid i sređivanje kablova',
        reason: ReportReason.SPAM,
        details: 'Isti oglas je objavljen dva puta pod drugim naslovom.',
        createdAt: hoursAgo(5),
      },
    });

    // Tarik invites Amra and Kenan to his open jobs, for the Pozivi tab.
    const invitations = [
      {
        id: 'seed-invitation-tv',
        listingId: 'seed-listing-tv',
        executorId: 'seed-user-amra',
        createdAt: hoursAgo(3),
      },
      {
        id: 'seed-invitation-groceries',
        listingId: 'seed-listing-groceries',
        executorId: 'seed-user-kenan',
        createdAt: hoursAgo(8),
      },
    ];
    for (const invitation of invitations) {
      await prisma.invitation.upsert({
        where: { id: invitation.id },
        update: {},
        create: invitation,
      });
    }

    console.log(
      `Seeded ${users.length} users, ${listings.length} jobs, ${addedPhotos === null ? 0 : photos.length} photos, ${applications.length} applications, ${ratings.length} ratings, ${conversations.length} conversations, 1 report and ${invitations.length} invitations.`,
    );
    console.log(`Sign in as amra@example.com with ${DEMO_PASSWORD}.`);
    console.log('Sign in as admin@example.com to handle reports.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
