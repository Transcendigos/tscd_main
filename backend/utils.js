
// Helper function to set auth cookie
export function setAuthCookie (reply, token) {
  return reply.setCookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  });
};