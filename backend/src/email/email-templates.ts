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
    intro: `Zdravo ${escapeHtml(fullName)}, unesi ovaj kod kako bi aktivirao svoj račun:`,
    code,
    note: 'Kod vrijedi 10 minuta. Ako nisi kreirao SaStrane račun, možeš zanemariti ovu poruku.',
  });
}

export function passwordResetEmailHtml(fullName: string, code: string) {
  return codeEmail({
    heading: 'Postavi novu lozinku',
    intro: `Zdravo ${escapeHtml(fullName)}, unesi ovaj kod kako bi postavio novu lozinku:`,
    code,
    note: 'Kod vrijedi 10 minuta. Ako nisi zatražio promjenu lozinke, možeš zanemariti ovu poruku.',
  });
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
