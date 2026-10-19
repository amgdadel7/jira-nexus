'use strict';

const { bad, notFound } = require('../../shared/errors');

const MAX_UPLOAD = 10 * 1024 * 1024;
const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/;

class AttachmentService {
  constructor({ db, guard, billing, attachmentRepo, issueRepo, storage }) {
    Object.assign(this, { db, guard, billing, attachments: attachmentRepo, issues: issueRepo, storage });
  }

  static get MAX_UPLOAD() {
    return MAX_UPLOAD;
  }

  async upload(actor, key, { filename: rawName, contentType, buffer }) {
    const issue = await this.guard.load(actor, key, 'CREATE_ATTACHMENTS');
    let filename = '';
    try { filename = decodeURIComponent(rawName || ''); } catch { filename = String(rawName || ''); }
    filename = filename.replace(/[/\\]/g, '_').slice(0, 200);
    if (!filename) throw bad('X-Filename header is required.');
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw bad('The file is empty.');
    await this.billing.assertStorage(buffer.length);
    const storedName = this.storage.save(buffer, filename);
    try {
      return await this.db.tx(async () => {
        const row = await this.attachments.insert({
          issueId: issue.id, filename, mime: (contentType || 'application/octet-stream').split(';')[0], size: buffer.length, storedName, uploaderId: actor.id,
        });
        await this.issues.touch(issue.id);
        await this.issues.addHistory({ issueId: issue.id, authorId: actor.id, field: 'attachment', to: filename });
        return row;
      });
    } catch (err) {
      this.storage.remove(storedName);
      throw err;
    }
  }

  /** Returns what the HTTP layer needs to stream the file. */
  async download(actor, id, { inline = false } = {}) {
    const attachment = await this.attachments.find(id);
    if (!attachment) throw notFound('Attachment not found.');
    await this.guard.load(actor, attachment.issue_key);
    if (!this.storage.exists(attachment.stored_name)) throw notFound('The file is missing from storage.');
    return {
      attachment,
      inline: inline && INLINE_TYPES.test(attachment.mime),
      stream: () => this.storage.stream(attachment.stored_name),
    };
  }

  async remove(actor, id) {
    const attachment = await this.attachments.find(id);
    if (!attachment) throw notFound('Attachment not found.');
    await this.guard.load(actor, attachment.issue_key, attachment.uploader_id === actor.id ? 'CREATE_ATTACHMENTS' : 'DELETE_ALL_ATTACHMENTS');
    await this.db.tx(async () => {
      await this.attachments.delete(attachment.id);
      await this.issues.addHistory({ issueId: attachment.issue_id, authorId: actor.id, field: 'attachment', from: attachment.filename });
    });
    this.storage.remove(attachment.stored_name);
    return { ok: true };
  }
}

module.exports = { AttachmentService };
