// HTML for the transactional emails. Every value that comes from a user goes
// through escapeHtml.

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const TEXT_STYLE = 'margin:0;color:#687978;line-height:1.6';
const NOTE_STYLE = 'margin:0;color:#687978;font-size:14px;line-height:1.6';

// The card with the SaStrane name that every email uses. `body` is HTML.
function layout(heading: string, body: string) {
  return `
      <!doctype html>
      <html lang="bs">
        <body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#1c2c33">
          <div style="max-width:560px;margin:0 auto;padding:40px 20px">
            <div style="background:#ffffff;border:1px solid #dfe9e7;border-radius:18px;padding:32px">
              <div style="font-size:20px;font-weight:700;color:#0f9f91">SaStrane</div>
              <h1 style="margin:28px 0 12px;font-size:24px">${heading}</h1>
              ${body}
            </div>
          </div>
        </body>
      </html>
    `;
}

function codeEmail(input: {
  heading: string;
  intro: string;
  code: string;
  note: string;
}) {
  return layout(
    input.heading,
    `<p style="${TEXT_STYLE}">${input.intro}</p>
              <div style="margin:28px 0;padding:18px;border-radius:12px;background:#eef9f7;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b746b">${escapeHtml(input.code)}</div>
              <p style="${NOTE_STYLE}">${input.note}</p>`,
  );
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:28px 0;padding:12px 22px;border-radius:10px;background:#0f9f91;color:#ffffff;font-weight:700;text-decoration:none">${label}</a>`;
}

export function verificationEmailHtml(fullName: string, code: string) {
  return codeEmail({
    heading: 'Potvrdi svoj email',
    intro: `Zdravo ${escapeHtml(fullName)}, unesi ovaj kod da aktiviraš svoj račun:`,
    code,
    note: 'Kod vrijedi 10 minuta. Ako ovaj zahtjev nije od tebe, možeš zanemariti ovu poruku.',
  });
}

export function passwordResetEmailHtml(fullName: string, code: string) {
  return codeEmail({
    heading: 'Postavi novu lozinku',
    intro: `Zdravo ${escapeHtml(fullName)}, unesi ovaj kod da postaviš novu lozinku:`,
    code,
    note: 'Kod vrijedi 10 minuta. Ako ovaj zahtjev nije od tebe, možeš zanemariti ovu poruku.',
  });
}

export function passwordChangedEmailHtml(fullName: string) {
  return layout(
    'Lozinka je promijenjena',
    `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(fullName)}, lozinka tvog SaStrane računa je upravo promijenjena. Ostali uređaji su odjavljeni.</p>
              <p style="${NOTE_STYLE};margin-top:20px">Ako ne prepoznaješ ovu promjenu, odmah postavi novu lozinku preko opcije „Zaboravljena lozinka“ u prozoru za prijavu.</p>`,
  );
}

export type ApplicationDecisionEmail = {
  email: string;
  fullName: string;
  listingTitle: string;
  clientName: string;
  accepted: boolean;
  // Absolute links into the web app.
  listingUrl: string;
  listingsUrl: string;
};

export function applicationDecisionSubject(input: ApplicationDecisionEmail) {
  return input.accepted
    ? 'Tvoja prijava je prihvaćena'
    : 'Odgovor na tvoju prijavu';
}

export function applicationDecisionEmailHtml(input: ApplicationDecisionEmail) {
  const name = escapeHtml(input.fullName);
  const title = escapeHtml(input.listingTitle);

  if (input.accepted) {
    return layout(
      'Prijava je prihvaćena',
      `<p style="${TEXT_STYLE}">Zdravo ${name}, tvoja prijava za oglas „${title}“ je prihvaćena. Javi se klijentu (${escapeHtml(input.clientName)}) kroz poruke na SaStrane i dogovorite detalje.</p>
              ${button(input.listingUrl, 'Otvori oglas')}
              <p style="${NOTE_STYLE}">Na stranici oglasa klikni „Pošalji poruku“.</p>`,
    );
  }

  return layout(
    'Prijava nije prihvaćena',
    `<p style="${TEXT_STYLE}">Zdravo ${name}, tvoja prijava za oglas „${title}“ nije prihvaćena. Hvala na interesu, i sretno sa sljedećim poslom.</p>
              ${button(input.listingsUrl, 'Pronađi drugi posao')}`,
  );
}

// The footer of the activity emails, which the user can turn off.
function settingsNote(settingsUrl: string) {
  return `<p style="${NOTE_STYLE};margin-top:8px;font-size:12px">Ove obavijesti možeš isključiti u <a href="${escapeHtml(settingsUrl)}" style="color:#0b746b">postavkama naloga</a>.</p>`;
}

// A quoted message, shortened to EXCERPT_LENGTH characters.
const EXCERPT_LENGTH = 300;

function quote(text: string) {
  const trimmed = text.trim();
  const excerpt =
    trimmed.length > EXCERPT_LENGTH
      ? `${trimmed.slice(0, EXCERPT_LENGTH).trimEnd()}…`
      : trimmed;
  return `<blockquote style="margin:20px 0 0;padding:12px 16px;border-left:3px solid #0f9f91;background:#f4f7f6;border-radius:8px;color:#1c2c33;line-height:1.6;white-space:pre-line">${escapeHtml(excerpt)}</blockquote>`;
}

// Whole KM with a dot between thousands, as on the site.
export function formatPrice(price: number | null) {
  if (price === null) return 'po dogovoru';
  return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} KM`;
}

export type NewApplicationEmail = {
  fullName: string;
  listingTitle: string;
  executorName: string;
  proposedPrice: number | null;
  message: string;
  // Absolute links into the web app.
  applicationsUrl: string;
  settingsUrl: string;
};

export function newApplicationSubject(input: { listingTitle: string }) {
  return `Nova prijava za oglas „${input.listingTitle}“`;
}

export function newApplicationEmailHtml(input: NewApplicationEmail) {
  return layout(
    'Nova prijava na tvoj oglas',
    `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, stigla je nova prijava za oglas „${escapeHtml(input.listingTitle)}“.</p>
              <p style="${TEXT_STYLE};margin-top:12px"><strong>Izvođač:</strong> ${escapeHtml(input.executorName)}<br><strong>Predložena cijena:</strong> ${formatPrice(input.proposedPrice)}</p>
              ${quote(input.message)}
              ${button(input.applicationsUrl, 'Pogledaj prijave')}
              ${settingsNote(input.settingsUrl)}`,
  );
}

export type InvitationEmail = {
  fullName: string;
  listingTitle: string;
  clientName: string;
  budget: number | null;
  // Absolute links into the web app.
  listingUrl: string;
  settingsUrl: string;
};

export function invitationSubject(input: { listingTitle: string }) {
  return `Poziv na oglas „${input.listingTitle}“`;
}

export function invitationEmailHtml(input: InvitationEmail) {
  return layout(
    'Poziv na posao',
    `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, ${escapeHtml(input.clientName)} te poziva da se prijaviš na oglas „${escapeHtml(input.listingTitle)}“.</p>
              <p style="${TEXT_STYLE};margin-top:12px"><strong>Budžet:</strong> ${formatPrice(input.budget)}</p>
              ${button(input.listingUrl, 'Pogledaj oglas')}
              <p style="${NOTE_STYLE}">Ako ti posao ne odgovara, poziv možeš odbiti u radnom prostoru.</p>
              ${settingsNote(input.settingsUrl)}`,
  );
}

export type NewListingMatchEmail = {
  fullName: string;
  listingTitle: string;
  budget: number | null;
  // Absolute links into the web app.
  listingUrl: string;
  settingsUrl: string;
};

export function newListingMatchSubject(input: { listingTitle: string }) {
  return `Nov oglas: „${input.listingTitle}“`;
}

export function newListingMatchEmailHtml(input: NewListingMatchEmail) {
  return layout(
    'Nov oglas za tebe',
    `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, objavljen je oglas koji odgovara tvom upozorenju: „${escapeHtml(input.listingTitle)}“.</p>
              <p style="${TEXT_STYLE};margin-top:12px"><strong>Budžet:</strong> ${formatPrice(input.budget)}</p>
              ${button(input.listingUrl, 'Pogledaj oglas')}
              <p style="${NOTE_STYLE}">Upozorenja za nove oglase možeš obrisati u postavkama.</p>
              ${settingsNote(input.settingsUrl)}`,
  );
}

const MONTHS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

// "9. decembar 2026." in Sarajevo time, spelled like the web app's dates.
export function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sarajevo',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return `${part('day')}. ${MONTHS[part('month') - 1]} ${part('year')}.`;
}

export type ListingExpiryEmail = {
  fullName: string;
  listingTitle: string;
  expiresAt: Date;
  // True once the job closed; false for the reminder before.
  expired: boolean;
  // Absolute links into the web app.
  listingUrl: string;
  settingsUrl: string;
};

export function listingExpirySubject(input: {
  listingTitle: string;
  expired: boolean;
}) {
  return input.expired
    ? `Oglas „${input.listingTitle}“ je istekao`
    : `Oglas „${input.listingTitle}“ uskoro ističe`;
}

export function listingExpiryEmailHtml(input: ListingExpiryEmail) {
  const title = escapeHtml(input.listingTitle);
  const body = input.expired
    ? `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, tvoj oglas „${title}“ je istekao i zatvoren je za nove prijave. Prijave koje već imaš i dalje možeš prihvatiti ili odbiti.</p>
              ${button(input.listingUrl, 'Otvori oglas')}
              <p style="${NOTE_STYLE}">Ako još tražiš izvođača, na stranici oglasa ga možeš ponovo otvoriti na 30 dana.</p>`
    : `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, tvoj oglas „${title}“ ističe i zatvara se za nove prijave.</p>
              <p style="${TEXT_STYLE};margin-top:12px"><strong>Datum isteka:</strong> ${formatDate(input.expiresAt)}</p>
              ${button(input.listingUrl, 'Produži oglas')}
              <p style="${NOTE_STYLE}">Ako još tražiš izvođača, produži oglas za 30 dana na njegovoj stranici. Ako ne, ne moraš ništa raditi.</p>`;
  return layout(
    input.expired ? 'Oglas je istekao' : 'Oglas uskoro ističe',
    `${body}
              ${settingsNote(input.settingsUrl)}`,
  );
}

// "1 nepročitana poruka", "3 nepročitane poruke", "5 nepročitanih poruka".
export function unreadMessagesText(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} nepročitana poruka`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} nepročitane poruke`;
  }
  return `${count} nepročitanih poruka`;
}

export type UnreadMessagesEmail = {
  fullName: string;
  listingTitle: string;
  senderName: string;
  unreadCount: number;
  lastMessage: string;
  // Absolute links into the web app.
  conversationUrl: string;
  settingsUrl: string;
};

export function unreadMessagesSubject(input: { listingTitle: string }) {
  return `Nova poruka o oglasu „${input.listingTitle}“`;
}

export function unreadMessagesEmailHtml(input: UnreadMessagesEmail) {
  return layout(
    'Imaš novu poruku',
    `<p style="${TEXT_STYLE}">Zdravo ${escapeHtml(input.fullName)}, u razgovoru o oglasu „${escapeHtml(input.listingTitle)}“ čeka te ${unreadMessagesText(input.unreadCount)}. Posljednja poruka (${escapeHtml(input.senderName)}):</p>
              ${quote(input.lastMessage)}
              ${button(input.conversationUrl, 'Otvori razgovor')}
              <p style="${NOTE_STYLE}">Za ovaj razgovor nema novih emailova dok ga ne otvoriš.</p>
              ${settingsNote(input.settingsUrl)}`,
  );
}
