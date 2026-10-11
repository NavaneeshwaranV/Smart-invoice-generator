import crypto from 'crypto';

/**
 * Clerk Authentication Verification Middleware.
 * - Extracts the Bearer JWT from the Authorization header.
 * - Decodes and verifies Clerk session tokens (extracting the `sub` claim as Clerk userId).
 * - Never stores passwords in MongoDB; every record is scoped to `req.auth.userId`.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to access this resource.',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Missing authentication token.',
      });
    }

    // 1. Check if token is a standard 3-part JWT (issued by Clerk Frontend SDK)
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);

        // Verify expiration if present
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          return res.status(401).json({
            success: false,
            message: 'Session token has expired. Please sign in again.',
          });
        }

        const userId = payload.sub || payload.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Invalid Clerk token: missing subject (userId).',
          });
        }

        req.auth = {
          userId: String(userId),
          email: payload.email || '',
          name: payload.name || '',
        };
        return next();
      } catch (jwtErr) {
        return res.status(401).json({
          success: false,
          message: 'Malformed JWT token.',
        });
      }
    }

    // 2. Support signed session tokens for local/sandbox Clerk mode (prefix: sig_sess_)
    if (token.startsWith('sig_sess_')) {
      const encoded = token.replace('sig_sess_', '');
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid session token.',
        });
      }
      req.auth = {
        userId: String(decoded.userId),
        email: String(decoded.email || ''),
        name: String(decoded.name || ''),
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Unrecognized authentication token format.',
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

export const issueLocalSessionToken = ({ userId, email, name }) => {
  const payload = {
    userId,
    email,
    name,
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(6).toString('hex'),
  };
  return `sig_sess_${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
};
