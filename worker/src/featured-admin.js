/**
 * Featured Admin identity — Worker side.
 *
 * Accepts either:
 *   1) Firebase ID token custom claim admin === true
 *   2) uid listed in env.ADMIN_UIDS (comma-separated secret)
 *
 * Never trust client-writable Firestore profile fields.
 */

export function parseAdminUids(env) {
  var raw = String((env && env.ADMIN_UIDS) || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map(function (s) {
      return String(s || '').trim();
    })
    .filter(Boolean);
}

/**
 * @param {{ uid: string, claims?: object }} user
 * @param {object} env
 */
export function isFeaturedAdminUser(user, env) {
  if (!user || !user.uid) return false;
  var claims = user.claims || {};
  if (claims.admin === true || claims.admin === 'true' || claims.admin === 1) {
    return true;
  }
  var allow = parseAdminUids(env);
  return allow.indexOf(String(user.uid)) !== -1;
}

export function assertFeaturedAdmin(user, env) {
  if (!isFeaturedAdminUser(user, env)) {
    var err = new Error('featured_admin_required');
    err.code = 'forbidden';
    err.status = 403;
    throw err;
  }
  return true;
}
