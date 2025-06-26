import speakeasy from 'speakeasy';
import { setAuthCookie } from './utils.js';
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';
import fp from 'fastify-plugin';


export default fp(async function twofaRoutes(server, options) {
  let db = getDB();
  // VERIFY SIGN IN ///////////
  server.post('/api/2fa/verify', async (req, reply) => {
    try {
      const { code, method, email } = req.body;
      console.log("2FA verify input:", code, method, email);

      if (!method || !code || !email) {
        return reply.code(400).send({ error: 'Missing fields' });
      }

      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (method === 'TOTP') {
        if (!user.totp_secret) {
          return reply.code(400).send({ error: 'TOTP not enabled' });
        }

        const valid = speakeasy.totp.verify({
          secret: user.totp_secret,
          encoding: 'base32',
          token: code,
          window: 1,
        });

        if (!valid) {
          return reply.code(400).send({ error: 'Invalid TOTP code' });
        }
      } else {
        return reply.code(400).send({ error: 'Unsupported 2FA method' });
      }

      const tokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        method_sign: user.method_sign,
        picture: user.picture || null,
      };

      const token = jwt.sign(tokenPayload, server.jwt_secret, { expiresIn: '7d' });
      setAuthCookie(reply, token);

      return reply.send({ message: '2FA verification successful', user: tokenPayload });
    } catch (err) {
      console.error("🔥 2FA verification error:", err);
      return reply.code(500).send({ error: "Internal server error during 2FA verification" });
    }
  });

});