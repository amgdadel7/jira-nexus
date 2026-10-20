'use strict';

const { bad } = require('../../shared/errors');
const { NOTIFY_TYPES } = require('../../domain/issue');

const THEMES = ['light', 'dark', 'system'];
const WEEK_STARTS = ['sunday', 'monday', 'saturday'];
const MAX_AVATAR = 1024 * 1024;
const IMAGE_SIGNATURES = [
  { ext: 'png', test: (b) => b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG' },
  { ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 3) === 'GIF' },
  { ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];
const AVATAR_FILE = /^[\w-]+\.(png|jpg|gif|webp)$/;

/** Personal settings (theme, motion, week start, notification switches) and the profile photo. */
class ProfileService {
  constructor({ userRepo, storage }) {
    Object.assign(this, { users: userRepo, storage });
  }

  static toPreferences(row) {
    const notify = Object.fromEntries(NOTIFY_TYPES.map((t) => [t, row?.notify?.[t] !== false]));
    return { theme: row?.theme || 'light', reduceMotion: Boolean(row?.reduce_motion), notify, weekStart: row?.week_start || 'sunday' };
  }

  async preferences(actor) {
    return ProfileService.toPreferences(await this.users.getPreferences(actor.id));
  }

  async updatePreferences(actor, body = {}) {
    const current = await this.preferences(actor);
    if (body.theme !== undefined) {
      if (!THEMES.includes(body.theme)) throw bad("Theme must be 'light', 'dark' or 'system'.");
      current.theme = body.theme;
    }
    if (body.reduceMotion !== undefined) current.reduceMotion = Boolean(body.reduceMotion);
    if (body.weekStart !== undefined) {
      if (!WEEK_STARTS.includes(body.weekStart)) throw bad('Unknown week start.');
      current.weekStart = body.weekStart;
    }
    if (body.notify !== undefined) {
      if (typeof body.notify !== 'object' || !body.notify) throw bad('notify must be an object.');
      for (const [type, on] of Object.entries(body.notify)) {
        if (!NOTIFY_TYPES.includes(type)) throw bad(`Unknown notification type '${type}'.`);
        current.notify[type] = Boolean(on);
      }
    }
    return ProfileService.toPreferences(await this.users.savePreferences(actor.id, current));
  }

  async setAvatar(actor, buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw bad('Choose an image to upload.');
    if (buffer.length > MAX_AVATAR) throw bad('Profile photos must be 1 MB or smaller.');
    const kind = IMAGE_SIGNATURES.find((s) => s.test(buffer));
    if (!kind) throw bad('Upload a PNG, JPG, GIF or WebP image.');
    const stored = this.storage.save(buffer, `avatar.${kind.ext}`, 'avatars', { prefix: actor.id });
    const file = stored.slice('avatars/'.length);
    const previous = actor.user?.avatar;
    const user = await this.users.update(actor.id, { avatar: file });
    if (previous) this.storage.remove(`avatars/${previous}`);
    return user;
  }

  async removeAvatar(actor) {
    const previous = actor.user?.avatar;
    const user = await this.users.update(actor.id, { avatar: null });
    if (previous) this.storage.remove(`avatars/${previous}`);
    return user;
  }

  /** Path of a public avatar file, or null. Names are unguessable, so <img> tags need no token. */
  avatarPath(file) {
    const name = String(file || '');
    if (!AVATAR_FILE.test(name) || !this.storage.exists(`avatars/${name}`)) return null;
    return this.storage.path(`avatars/${name}`);
  }
}

module.exports = { ProfileService };
