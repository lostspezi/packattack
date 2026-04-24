const baseStyle = `
  font-family: Arial, sans-serif;
  background-color: #12111A;
  color: #ffffff;
  margin: 0;
  padding: 0;
`;

const containerStyle = `
  max-width: 600px;
  margin: 40px auto;
  background-color: #1C1B26;
  border-radius: 8px;
  overflow: hidden;
`;

const headerStyle = `
  background-color: #12111A;
  padding: 24px 32px;
  border-bottom: 2px solid #9BFF00;
`;

const bodyStyle = `
  padding: 32px;
`;

const buttonStyle = `
  display: inline-block;
  background-color: #9BFF00;
  color: #12111A;
  font-weight: bold;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  margin: 24px 0;
`;

const footerStyle = `
  padding: 16px 32px;
  background-color: #12111A;
  color: #888888;
  font-size: 12px;
  text-align: center;
`;

function buildEmail(content: { de: string; en: string }): { de: string; en: string } {
  return {
    de: `<html><body style="${baseStyle}"><div style="${containerStyle}"><div style="${headerStyle}"><h1 style="margin:0;color:#9BFF00;font-size:24px;">PACKATTACK.gg</h1></div><div style="${bodyStyle}">${content.de}</div><div style="${footerStyle}">© PACKATTACK.gg — Alle Rechte vorbehalten</div></div></body></html>`,
    en: `<html><body style="${baseStyle}"><div style="${containerStyle}"><div style="${headerStyle}"><h1 style="margin:0;color:#9BFF00;font-size:24px;">PACKATTACK.gg</h1></div><div style="${bodyStyle}">${content.en}</div><div style="${footerStyle}">© PACKATTACK.gg — All rights reserved</div></div></body></html>`,
  };
}

export const emailTemplateSeedData = [
  {
    slug: "welcome",
    name: "Welcome Email",
    subject: {
      de: "Willkommen bei PACKATTACK.gg!",
      en: "Welcome to PACKATTACK.gg!",
    },
    body: buildEmail({
      de: `
        <h2 style="color:#ffffff;">Hallo {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Willkommen bei PACKATTACK.gg! Wir freuen uns, dich in unserer Community begrüßen zu dürfen.
          Dein Account wurde erfolgreich erstellt.
        </p>
        <p style="color:#cccccc;line-height:1.6;">
          Klicke auf den Button unten, um dich einzuloggen und loszulegen:
        </p>
        <a href="{{loginUrl}}" style="${buttonStyle}">Jetzt einloggen</a>
        <p style="color:#888888;font-size:13px;">
          Falls du diesen Account nicht erstellt hast, kannst du diese Email ignorieren.
        </p>
      `,
      en: `
        <h2 style="color:#ffffff;">Hello {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Welcome to PACKATTACK.gg! We're excited to have you in our community.
          Your account has been created successfully.
        </p>
        <p style="color:#cccccc;line-height:1.6;">
          Click the button below to log in and get started:
        </p>
        <a href="{{loginUrl}}" style="${buttonStyle}">Log in now</a>
        <p style="color:#888888;font-size:13px;">
          If you did not create this account, you can safely ignore this email.
        </p>
      `,
    }),
    variables: ["username", "loginUrl"],
  },
  {
    slug: "verify-email",
    name: "Email Verification",
    subject: {
      de: "Bestätige deine Email-Adresse",
      en: "Verify your email address",
    },
    body: buildEmail({
      de: `
        <h2 style="color:#ffffff;">Hallo {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Bitte bestätige deine Email-Adresse, indem du auf den folgenden Button klickst.
          Der Link ist 24 Stunden gültig.
        </p>
        <a href="{{verifyUrl}}" style="${buttonStyle}">Email bestätigen</a>
        <p style="color:#888888;font-size:13px;">
          Dieser Link läuft nach 24 Stunden ab. Falls du keine Bestätigungsemail angefordert hast,
          kannst du diese Email ignorieren.
        </p>
      `,
      en: `
        <h2 style="color:#ffffff;">Hello {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Please verify your email address by clicking the button below.
          The link is valid for 24 hours.
        </p>
        <a href="{{verifyUrl}}" style="${buttonStyle}">Verify email</a>
        <p style="color:#888888;font-size:13px;">
          This link expires after 24 hours. If you did not request this verification,
          you can safely ignore this email.
        </p>
      `,
    }),
    variables: ["username", "verifyUrl"],
  },
  {
    slug: "password-reset",
    name: "Password Reset",
    subject: {
      de: "Passwort zurücksetzen",
      en: "Reset your password",
    },
    body: buildEmail({
      de: `
        <h2 style="color:#ffffff;">Hallo {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.
          Klicke auf den Button unten, um ein neues Passwort festzulegen.
          Der Link ist 1 Stunde gültig.
        </p>
        <a href="{{resetUrl}}" style="${buttonStyle}">Passwort zurücksetzen</a>
        <p style="color:#888888;font-size:13px;">
          Dieser Link läuft nach 1 Stunde ab. Falls du kein neues Passwort angefordert hast,
          kannst du diese Email ignorieren. Dein Passwort bleibt unverändert.
        </p>
      `,
      en: `
        <h2 style="color:#ffffff;">Hello {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          We received a request to reset your password.
          Click the button below to set a new password.
          The link is valid for 1 hour.
        </p>
        <a href="{{resetUrl}}" style="${buttonStyle}">Reset password</a>
        <p style="color:#888888;font-size:13px;">
          This link expires after 1 hour. If you did not request a password reset,
          you can safely ignore this email. Your password will remain unchanged.
        </p>
      `,
    }),
    variables: ["username", "resetUrl"],
  },
  {
    slug: "consent-update",
    name: "Terms Updated",
    subject: {
      de: "Nutzungsbedingungen aktualisiert",
      en: "Terms of service updated",
    },
    body: buildEmail({
      de: `
        <h2 style="color:#ffffff;">Hallo {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          Wir haben unsere Nutzungsbedingungen aktualisiert. Um PACKATTACK.gg weiterhin nutzen zu können,
          bitten wir dich, die aktualisierten {{type}} zu akzeptieren.
        </p>
        <p style="color:#cccccc;line-height:1.6;">
          Klicke auf den Button unten, um die Änderungen einzusehen und zu akzeptieren:
        </p>
        <a href="{{acceptUrl}}" style="${buttonStyle}">Jetzt akzeptieren</a>
        <p style="color:#888888;font-size:13px;">
          Falls du Fragen hast, kontaktiere uns bitte über unseren Support.
        </p>
      `,
      en: `
        <h2 style="color:#ffffff;">Hello {{username}},</h2>
        <p style="color:#cccccc;line-height:1.6;">
          We have updated our terms. To continue using PACKATTACK.gg,
          please accept the updated {{type}}.
        </p>
        <p style="color:#cccccc;line-height:1.6;">
          Click the button below to review and accept the changes:
        </p>
        <a href="{{acceptUrl}}" style="${buttonStyle}">Accept now</a>
        <p style="color:#888888;font-size:13px;">
          If you have any questions, please contact our support team.
        </p>
      `,
    }),
    variables: ["username", "acceptUrl", "type"],
  },
];
