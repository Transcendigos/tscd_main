// tscd_main/backend/auth.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getDB } from './db.js'; // Assuming db.js is in the same directory

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Helper function to set auth cookie
export const setAuthCookie = (reply, token) => {
  return reply.setCookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  });
};

export default async function authRoutes(server, options) {
  const db = getDB();
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  if (process.env.GOOGLE_CLIENT_ID) {
      console.log("Auth Routes: GOOGLE_CLIENT_ID loaded.");
  } else {
      console.warn("Auth Routes: GOOGLE_CLIENT_ID is not set. Google Sign-In will fail.");
  }


  // SIGN-UP SECTION - NO GOOGLE
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
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username, email, hashedPassword],
          function (err) {
            if (err) return reject(err);
            insertedUserId = this.lastID;
            resolve();
          }
        );
      });

      const tokenPayload = { userId: insertedUserId, username, email };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
      
      reply.clearCookie('session_token', { path: '/' }); // cleanup legacy
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

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
          server.log.error('Google token payload is invalid or missing email/sub', payload);
          return reply.code(401).send({ error: 'Invalid Google token: Payload incomplete.' });
      }
      const { sub, email, name, picture } = payload;

      let dbUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username, email, picture FROM users WHERE email = ?',
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
        while(usernameConflict) {
          const existingUsernameUser = await new Promise((resolve, reject) => {
              db.get('SELECT id FROM users WHERE username = ?', [attemptUsername], (err, row) => {
                  if(err) return reject(err);
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
            'INSERT INTO users (username, email, password, picture) VALUES (?, ?, ?, ?)',
            [finalUsername, email, `oauth-google-${sub}`, finalPicture],
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
        finalPicture = dbUser.picture || picture;
        if (finalPicture !== dbUser.picture) {
          db.run('UPDATE users SET picture = ? WHERE id = ?', [finalPicture, userIdToSign], (err) => {
              if(err) server.log.error({err, userId: userIdToSign}, "Error updating user picture during Google Sign-In");
          });
        }
        server.log.info({ email, username: finalUsername, userId: userIdToSign }, "Existing user signed in via Google");
      }
      const tokenPayload = { userId: userIdToSign, username: finalUsername, email, picture: finalPicture };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
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

    const twofaMethods = [];
    if (user.totp_secret) 
      twofaMethods.push('totp');
    if (user.email_2fa_enabled) 
      twofaMethods.push('email');

    if (twofaMethods.length > 0) {
      return reply.send({
        twofa_required: true,
        available_methods: twofaMethods,
        email: user.email,
      });
    }

    // No 2FA → issue token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      picture: user.picture || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
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
    payload = jwt.verify(token, JWT_SECRET);
    if (!payload.userId || !payload.username || !payload.email) {
      server.log.warn({ payload }, 'JWT payload missing expected fields for /api/me');
      reply.clearCookie('auth_token', { path: '/' });
      return reply.send({ signedIn: false, error: 'Invalid session data.' });
    }
  } catch (err) {
    server.log.warn({ err }, 'Invalid token for /api/me');
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send({ signedIn: false });
  }

  // 🔍 Fetch user’s 2FA status from DB
  const userRow = await new Promise((resolve, reject) => {
    db.get(
      'SELECT totp_secret, email_2fa_enabled FROM users WHERE id = ?',
      [payload.userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });

  reply.send({
    signedIn: true,
    user: {
      ...payload,
      totp_enabled: Boolean(userRow?.totp_secret),
      email_enabled: Boolean(userRow?.email_2fa_enabled),
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
      const query = 'SELECT id, username, email, picture FROM users';
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
}