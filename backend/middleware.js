import jwt from 'jsonwebtoken';

export function authenticate(request, reply, done) {
    const token = request.cookies.auth_token;
    if (!token) {
        return reply.code(401).send({ error: 'Authentication required. No token provided.' });
    }

    try {
        const payload = jwt.verify(token, request.server.jwt_secret);
        if (!payload.userId) {
             return reply.code(401).send({ error: 'Invalid token payload.' });
        }
        // Attach user info to the request for other handlers to use
        request.user = { id: payload.userId, username: payload.username };
        done();
    } catch (err) {
        return reply.code(401).send({ error: 'Authentication failed. Invalid token.' });
    }
}