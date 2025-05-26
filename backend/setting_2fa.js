import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';


const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Update Db User table to change the email_2fa_enabled

export default async function setting_twofa(server, options) {
  
  const db = getDB();

  server.post('/api/2fa/enable-email', async (req, reply) => {
    const { enable } = req.body;
    const token = req.cookies.auth_token;

    if (!token) return reply.code(401).send({ error: 'Not authenticated' });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return reply.code(401).send({ error: 'Invalid session token' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET email_2fa_enabled = ? WHERE id = ?',
        [enable ? 1 : 0, user.userId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    return reply.send({
      message: `Email 2FA ${enable ? 'enabled' : 'disabled'}`,
    });
  });

  //SET UP TOTP (create the secret key for server and phone of the client)
  server.post('/api/2fa/setup-totp', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token)
      return reply.code(401).send({ error: 'Not logged in' });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    }
    catch {
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
    if (!userToken || !secret) {
      return reply.code(400).send({ error: 'Missing token or secret' });
    }

    const jwtToken = req.cookies.auth_token;
    if (!jwtToken)
      return reply.code(401).send({ error: 'Not logged in' });

    let user;
    try {
      user = jwt.verify(jwtToken, JWT_SECRET);
    }
    catch {
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


  server.post('/api/2fa/disable-totp', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) return reply.code(401).send({ error: 'Not authenticated' });

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      return reply.code(401).send({ error: 'Invalid session token' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET totp_secret = NULL WHERE id = ?',
        [user.userId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    return reply.send({ message: 'TOTP 2FA has been disabled.' });
  });

}