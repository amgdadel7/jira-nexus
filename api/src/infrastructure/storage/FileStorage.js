'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Local-disk blob storage for attachments and avatars (UPLOAD_DIR). */
class FileStorage {
  constructor({ config }) {
    this.root = config.uploadDir;
    fs.mkdirSync(this.root, { recursive: true });
  }

  /** Saves a buffer under a random name, keeping a short extension. Returns the stored name. */
  save(buffer, originalName = '', subdir = '', { prefix = '' } = {}) {
    const ext = path.extname(originalName).slice(0, 10);
    const id = crypto.randomBytes(8).toString('hex');
    const name = prefix ? `${prefix}-${id}${ext}` : `${crypto.randomBytes(12).toString('hex')}${ext}`;
    const stored = subdir ? `${subdir}/${name}` : name;
    fs.mkdirSync(path.dirname(this.path(stored)), { recursive: true });
    fs.writeFileSync(this.path(stored), buffer);
    return stored;
  }

  path(storedName) {
    const full = path.resolve(this.root, storedName);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid stored file name.');
    return full;
  }

  exists(storedName) {
    return fs.existsSync(this.path(storedName));
  }

  stream(storedName) {
    return fs.createReadStream(this.path(storedName));
  }

  remove(storedName) {
    if (storedName) fs.rm(this.path(storedName), { force: true }, () => {});
  }
}

module.exports = { FileStorage };
