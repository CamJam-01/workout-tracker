const jwt = require("jsonwebtoken");

const COOKIE_NAME = "stride_token";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Read lazily (not at module load) so importing this file during framework
// detection/build never throws — only signing/verifying a token does, if the
// env var is still missing at that point.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required (used to sign session cookies)."
    );
  }
  return secret;
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    return payload.sub;
  } catch {
    return null;
  }
}

function setAuthCookie(res, userId) {
  res.cookie(COOKIE_NAME, signToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

function getUserIdFromReq(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

function requireAuth(req, res, next) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  req.userId = userId;
  next();
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  getUserIdFromReq,
  requireAuth,
};
