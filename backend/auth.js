// tscd_main/backend/auth.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getDB } from './db.js'; // Assuming db.js is in the same directory
import fp from 'fastify-plugin';
import { setAuthCookie } from './utils.js';

export default fp(async function authRoutes(server, options) {
  const db = getDB();
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  if (process.env.GOOGLE_CLIENT_ID) {
    console.log("Auth Routes: GOOGLE_CLIENT_ID loaded.");
  } else {
    console.warn("Auth Routes: GOOGLE_CLIENT_ID is not set. Google Sign-In will fail.");
  }


  // SIGN-UP SECTION - NO GOOGLE / LOCAL
  server.post('/api/signup', async (req, reply) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Missing fields' });
    }

    try {
      const existingUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE email = ? OR username = ?',
          [email, username],
          (err, row) => {
            if (err) return reject(err);
            resolve(row);
          }
        );
      });

      if (existingUser) {
        const conflictField = existingUser.email === email ? 'email' : 'username';
        return reply.code(409).send({ error: `A user with that ${conflictField} already exists` });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let insertedUserId;
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password, method_sign) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, 'local'],
          function (err) {
            if (err) return reject(err);
            insertedUserId = this.lastID;
            resolve();
          }
        );
      });

      const tokenPayload = { userId: insertedUserId, username, email, method_sign: 'local', picture: null };
      const token = jwt.sign(tokenPayload, server.jwt_secret, { expiresIn: '7d' });

      reply.clearCookie('session_token', { path: '/' });
      server.log.info({ username, email, userId: insertedUserId }, "User signed up successfully");
      setAuthCookie(reply, token);

      return reply.code(201).send({ message: 'Signup successful', user: tokenPayload });

    } catch (err) {
      server.log.error({ err }, 'Signup error');
      return reply.code(500).send({ error: 'Server error during signup' });
    }
  });

  //GOOGLE AUTHORIZATION SIGN UP
  server.post('/api/google-login', async (req, reply) => {
    const { credential } = req.body;
    console.log("🔍 [GOOGLE-AUTH] Verifying token with audience:", process.env.GOOGLE_CLIENT_ID);
    console.log("🔍 [GOOGLE-AUTH] Credential (first 20 chars):", credential?.slice(0, 20));

    if (!credential) {
      return reply.code(400).send({ error: 'Missing credential token' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      server.log.error("Google Sign-In failed: GOOGLE_CLIENT_ID is not configured on the server.");
      return reply.code(500).send({ error: 'Google Sign-In is not configured correctly on the server.' });
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      if (!ticket) {
        server.log.error("🛑 Google token verification failed — no ticket returned.");
        return reply.code(401).send({ error: "Token verification failed." });
      }
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        server.log.error('Google token payload is invalid or missing email/sub', payload);
        return reply.code(401).send({ error: 'Invalid Google token: Payload incomplete.' });
      }
      const { sub, email, name, picture } = payload;

      let dbUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username, email, method_sign, picture FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) return reject(err);
            resolve(row);
          }
        );
      });

      let userIdToSign;
      let finalUsername = name || email.split('@')[0];
      let finalPicture = picture || null;

      if (!dbUser) {
        let attemptUsername = finalUsername;
        let usernameConflict = true;
        let counter = 0;
        while (usernameConflict) {
          const existingUsernameUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE username = ?', [attemptUsername], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });
          if (!existingUsernameUser) {
            usernameConflict = false;
            finalUsername = attemptUsername;
          } else {
            counter++;
            attemptUsername = (name || email.split('@')[0]) + `_${counter}`;
          }
        }

        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO users (username, email, password, method_sign, picture) VALUES (?, ?, ?, ?, ?)',
            [finalUsername, email, `oauth-google-${sub}`, 'google', finalPicture],
            function (err) {
              if (err) return reject(err);
              userIdToSign = this.lastID;
              resolve();
            }
          );
        });
        server.log.info({ email, username: finalUsername, userId: userIdToSign }, "New user created via Google Sign-In");
      } else {
        userIdToSign = dbUser.id;
        finalUsername = dbUser.username;
        server.log.info({ picture, dbuser: dbUser.picture }, "all photo");
        finalPicture = picture || dbUser.picture;
        if (finalPicture && finalPicture !== dbUser.picture) {
          try {
            await new Promise((resolve, reject) => {
              db.run('UPDATE users SET picture = ? WHERE id = ?', [finalPicture, userIdToSign], function(err) {
                if (err) {
                  server.log.error({ err, userId: userIdToSign }, "Error updating user picture during Google Sign-In");
                  return reject(err);
                }
                resolve();
              });
            });
          } catch (err) {
            return reply.code(500).send({ error: 'Failed to update user profile.' });
          }
        }
        server.log.info({ email, username: finalUsername, userId: userIdToSign }, "Existing user signed in via Google");
      }
      const tokenPayload = { userId: userIdToSign, username: finalUsername, email, method_sign: 'google', picture: finalPicture };
      const token = jwt.sign(tokenPayload, server.jwt_secret, { expiresIn: '7d' });
      setAuthCookie(reply, token);

      return reply.send({ message: 'Google login successful', user: tokenPayload });

    } catch (err) {
      server.log.error({ err }, 'Google login error');
      return reply.code(401).send({ error: 'Invalid Google token or server processing error.' });
    }
  });


  //////SIGN IN///////////////////////
  server.post('/api/signin', async (req, reply) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return reply.code(400).send({ error: 'Missing email or password' });
    }

    try {
      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) return reject(err);
            resolve(row);
          }
        );
      });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      if (user.totp_secret) {
        return reply.send({
          twofa_required: true,
          available_methods: 'TOTP',
          email: user.email,
        });
      }

      // No 2FA → issue token
      const tokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        method_sign: user.method_sign,
        picture: user.picture || null,
      };

      const token = jwt.sign(tokenPayload, server.jwt_secret, { expiresIn: '7d' });
      setAuthCookie(reply, token);

      return reply.send({ message: 'Login successful', user: tokenPayload });

    } catch (err) {
      server.log.error({ err }, 'Signin error');
      return reply.code(500).send({ error: 'Server error during signin' });
    }
  });

  ////////////////////END SIGN IN//////////////////////////////

  // SECTION VERIFY IF LOG IN
  server.get('/api/me', async (req, reply) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return reply.send({ signedIn: false });
    }

    let payload;
    try {
      payload = jwt.verify(token, server.jwt_secret);
      if (!payload.userId) { // Simplified check
        server.log.warn({ payload }, 'JWT payload missing userId for /api/me');
        reply.clearCookie('auth_token', { path: '/' });
        return reply.send({ signedIn: false, error: 'Invalid session data.' });
      }
    } catch (err) {
      server.log.warn({ err }, 'Invalid token for /api/me');
      reply.clearCookie('auth_token', { path: '/' });
      return reply.send({ signedIn: false });
    }

    // Fetch user from DB
    const userRow = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [payload.userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (!userRow) {
      server.log.warn({ userId: payload.userId }, 'User from valid token not found in DB.');
      reply.clearCookie('auth_token', { path: '/' }); // Clear the bad cookie
      return reply.send({ signedIn: false, error: 'User not found.' });
    }

    reply.send({
      signedIn: true,
      user: {
        userId: userRow.id,
        username: userRow.username,
        email: userRow.email,

        picture: userRow.picture,
        totp_enabled: Boolean(userRow.totp_secret),
        method_sign: userRow.method_sign,
      },
    });
  });

  // SECTION LOG OUT
  server.post('/api/logout', (req, reply) => {
    reply
      .clearCookie('auth_token', { path: '/' })
      .send({ message: 'Logged out' });
    server.log.info("User logged out");
  });

  // Dev endpoint
  server.get('/api/dev/users', async (req, reply) => {
    try {
      const query = 'SELECT id, username, email, method_sign, picture, totp_secret FROM users';
      const rows = await new Promise((resolve, reject) => {
        db.all(query, [], (err, resultRows) => {
          if (err) return reject(err);
          resolve(resultRows);
        });
      });
      return reply.send(rows);
    } catch (err) {
      server.log.error({ err }, '[GET /api/dev/users] Error fetching users:');
      return reply.code(500).send({ error: 'Failed to fetch users.' });
    }
  });


  //METHOD OF SIGNING
  server.get('/api/auth/methods', async (req, reply) => {
    const { email } = req.query;

    if (!email) {
      return reply.code(400).send({ error: "Missing email query parameter." });
    }

    try {
      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT method_sign FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) return reject(err);
            resolve(row);
          }
        );
      });

      if (!user) return reply.send({ methods: [] });

      const methods = [];

      if (user.method_sign === 'local') methods.push('local');
      if (user.method_sign === 'google') methods.push('google');

      return reply.send({ methods });
    } catch (err) {
      server.log.error({ err }, 'Error fetching login method');
      return reply.code(500).send({ error: "Server error" });
    }
  });

});