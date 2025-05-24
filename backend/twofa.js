import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';


////////////////EMAIL/////////////////////////////////
const resend = new Resend(process.env.RESEND_API_KEY);

// TO SEND EMAIL FOR 2FA
export async function sendEmail(to, subject, text) {
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


/////////////////////TOTP//////////////////////////////////////////////////

//SET UP TOTP (create the secret key for server and phone of the client)
server.post('/api/2fa/setup-totp', async (req, reply) => {
  const token = req.cookies.auth_token;
  if (!token) 
    return reply.code(401).send({ error: 'Not logged in' });

  let user;
  try 
  {
    user = jwt.verify(token, JWT_SECRET);
  } 
  catch 
  {
    return reply.code(401).send({ error: 'Invalid token' });
  }

  // Step 1: Generate secret
  const secret = speakeasy.generateSecret({
    name: `Transcendance (${user.email})`,
  });

  // Step 2: Create QR code
  const otpAuthUrl = secret.otpauth_url;
  const qrCode = await qrcode.toDataURL(otpAuthUrl);

  // Step 3: Send secret and QR to frontend (temporary)
  reply.send({
    qrCodeUrl: qrCode,
    base32: secret.base32, // used later to confirm user input
  });

});

// REGISTER TOTP (verify the secret code and store in DB)
server.post('/api/2fa/verify-totp', async (req, reply) => {
  const { token: userToken, secret } = req.body;
  if (!userToken || !secret)
  {
    return reply.code(400).send({ error: 'Missing token or secret' });
  }

  const jwtToken = req.cookies.auth_token;
  if (!jwtToken) 
    return reply.code(401).send({ error: 'Not logged in' });

  let user;
  try 
  {
    user = jwt.verify(jwtToken, JWT_SECRET);
  } 
  catch 
  {
    return reply.code(401).send({ error: 'Invalid session token' });
  }

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: userToken,
    window: 1, // allow 30s drift
  });

  if (!verified) {
    return reply.code(400).send({ error: 'Invalid TOTP code' });
  }

  // Save secret to DB
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET totp_secret = ? WHERE id = ?',
      [secret, user.id],
      (err) => (err ? reject(err) : resolve())
    );
  });

  reply.send({ message: 'TOTP 2FA enabled successfully' });
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

  // ✅ If valid: issue JWT
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      auth_provider: user.auth_provider,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return reply
    .setCookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
    .send({ message: 'Login successful with 2FA' });
});

