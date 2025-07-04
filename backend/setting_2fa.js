import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';
import fp from 'fastify-plugin';

export default fp(async function twoFASettingRoutes(server, options) {

  let db = getDB();

  //SET UP TOTP (create the secret key for server and phone of the client)
  server.post('/api/2fa/setup-totp', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token)
      return reply.code(401).send({ error: 'Not logged in' });

    let user;
    try {
      user = jwt.verify(token, server.jwt_secret);
    }
    catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    const secret = speakeasy.generateSecret({
      name: `Transcendance (${user.email})`,
    });

    let qrCode;
    try {
      const otpAuthUrl = secret.otpauth_url;
      qrCode = await qrcode.toDataURL(otpAuthUrl);
    }
    catch (err) {
      console.error("❌ Failed to generate QR code:", err);
      return reply.code(500).send({ error: "QR code generation failed" });
    }

    reply.send({
      qrCodeUrl: qrCode,
      base32: secret.base32,
    });

  });

  // REGISTER TOTP (verify the secret code and store in DB)
  server.post('/api/2fa/verify-totp', async (req, reply) => {
    const { token: userToken, secret } = req.body;
    if (!userToken || !secret) {
      return reply.code(400).send({ error: 'Missing token or secret' });
    }

    const jwtToken = req.cookies.auth_token;
    if (!jwtToken) {
      return reply.code(401).send({ error: 'Not logged in' });
    }

    let user;
    try {
      user = jwt.verify(jwtToken, server.jwt_secret);
    }
    catch {
      return reply.code(401).send({ error: 'Invalid session token' });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: userToken,
      window: 1,
    });

    if (!verified) {
      return reply.code(400).send({ error: 'Invalid TOTP code' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET totp_secret = ? WHERE id = ?',
        [secret, user.userId],
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
      user = jwt.verify(token, server.jwt_secret);
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

});