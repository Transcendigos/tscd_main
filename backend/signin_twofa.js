import speakeasy from 'speakeasy';
import { setAuthCookie } from './auth.js';


export default async function twofaRoutes(server, options) {

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

    if (method === 'totp') {
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

    }
    else {
      return reply.code(400).send({ error: 'Unsupported 2FA method' });
    }

    // If verified, issue JWT
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      method_sign: user.method_sign,
      picture: user.picture || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(reply, token);

    return reply.send({ message: '2FA verification successful', user: tokenPayload });
  });

}