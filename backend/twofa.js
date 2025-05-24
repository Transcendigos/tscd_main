import speakeasy from 'speakeasy';
import { Resend } from 'resend';
import { setAuthCookie } from './auth.js';


export default async function twofaRoutes(server, options) {

////////////////EMAIL/////////////////////////////////
const resend = new Resend(process.env.RESEND_API_KEY);

// TO SEND EMAIL FOR 2FA
async function sendEmail(to, subject, text) {
  try {
    const result = await resend.emails.send({
      from: 'Transcendance <noreply@resend.dev>',
      to,
      subject,
      text,
    });
    console.log('Email sent via Resend:', result.id || result);
  } catch (err) {
    console.error('Resend sendEmail failed:', err.message);
  }
}

// SEND EMAIL CODE FOR EMAIL VERIFICATION
server.post('/api/2fa/send-code', async (req, reply) => {
  const { email } = req.body;
  if (!email) return reply.code(400).send({ error: 'Email is required' });

  const user = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

  if (!user || !user.email_2fa_enabled) {
    return reply.code(400).send({ error: 'Email 2FA is not enabled for this account' });
  }

  // Step 1: generate 6-digit numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Step 2: set expiry (in seconds)
  const expiry = Math.floor(Date.now() / 1000) + 5 * 60;

  // Step 3: save to database
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET email_2fa_code = ?, email_2fa_expiry = ? WHERE id = ?',
      [code, expiry, user.id],
      (err) => (err ? reject(err) : resolve())
    );
  });

  await sendEmail(
    email,
    'Your Transcendance 2FA Code',
    `Your one-time login code is: ${code}\n\nThis code will expire in 5 minutes.`
);

  reply.send({ message: '2FA code sent to email' });
});


/////////////////////////////////////////////////////////////////////////////////////////
// VERIFY SIGN IN ///////////
server.post('/api/2fa/verify', async (req, reply) => {
  const { method, code, email } = req.body;
  if (!method || !code || !email) {
    return reply.code(400).send({ error: 'Missing fields' });
  }

  // Lookup user by email
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

  if (!user) {
    return reply.code(404).send({ error: 'User not found' });
  }

  if (method === 'totp') 
  {
    if (!user.totp_secret) 
    {
      return reply.code(400).send({ error: 'TOTP not enabled' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) 
    {
      return reply.code(400).send({ error: 'Invalid TOTP code' });
    }

  } 
  else if (method === 'email') 
  {
    if (!user.email_2fa_enabled || !user.email_2fa_code || !user.email_2fa_expiry) 
    {
      return reply.code(400).send({ error: 'Email 2FA not enabled or code missing' });
    }

    if (code !== user.email_2fa_code || Date.now() / 1000 > user.email_2fa_expiry) 
    {
      return reply.code(400).send({ error: 'Invalid or expired email code' });
    }

  } 
  else 
  {
    return reply.code(400).send({ error: 'Unsupported 2FA method' });
  }

// If verified, issue JWT
  const tokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    picture: user.picture || null,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(reply, token);

  return reply.send({ message: '2FA verification successful', user: tokenPayload });
});

}