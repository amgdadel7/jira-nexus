import React, { useRef, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Modal, Spinner } from './ui.jsx'

const THEMES = [
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'system', label: 'Match browser', icon: 'monitor' },
]
const NOTIFY = [
  { id: 'assigned', label: 'Work is assigned to me', hint: 'When someone makes you the assignee of a work item.' },
  { id: 'status', label: 'Status changes on work I watch', hint: 'Transitions on work items you report, are assigned or watch.' },
  { id: 'comment', label: 'Comments on work I watch', hint: 'New comments on work items you follow.' },
  { id: 'mention', label: 'I’m mentioned', hint: 'When someone @mentions you in a comment or description.' },
]

/** Personal settings: appearance (theme + motion), notifications and profile photo. */
export function PreferencesModal({ onClose }) {
  const { prefs, savePrefs, currentUser, refreshMeta, toast } = useApp()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const p = prefs || { theme: 'light', reduceMotion: false, weekStart: 'sunday', notify: {} }

  const upload = async (file) => {
    if (!file) return
    setErr(null)
    if (file.size > 1024 * 1024) { setErr('Profile photos must be 1 MB or smaller.'); return }
    setBusy(true)
    try { await api.uploadAvatar(file); await refreshMeta(); toast('Profile photo updated') } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const removePhoto = async () => {
    setBusy(true)
    try { await api.deleteAvatar(); await refreshMeta(); toast('Profile photo removed') } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} width={620} labelledBy="prefs-title">
      <div className="modal-header"><h2 id="prefs-title">Personal settings</h2><button className="icon-btn" onClick={onClose} title="Close"><Icon name="close" size={18} /></button></div>
      <div className="modal-body scroll" data-testid="preferences">
        <h3 className="section-title">Profile photo</h3>
        <div className="avatar-edit">
          <Avatar user={currentUser} size={72} />
          <div>
            <div className="row-gap">
              <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />Upload a photo</button>
              {currentUser.avatarUrl && <button className="btn subtle" disabled={busy} onClick={removePhoto}>Remove</button>}
              {busy && <Spinner size="small" />}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>PNG, JPG, GIF or WebP, up to 1 MB. Without a photo we show your initials.</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden data-testid="avatar-input"
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </div>
        {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}

        <hr />
        <h3 className="section-title">Appearance</h3>
        <div className="theme-options" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={p.theme === t.id} className={`theme-option ${p.theme === t.id ? 'on' : ''}`}
              onClick={() => savePrefs({ theme: t.id })} data-theme-option={t.id}>
              <span className={`theme-swatch ${t.id}`}><span className="sw-side" /><span className="sw-main"><span className="sw-line b" /><span className="sw-line" /><span className="sw-line" /></span></span>
              <span className="row-gap"><Icon name={t.icon} size={16} />{t.label}</span>
            </button>
          ))}
        </div>
        <div className="pref-row">
          <div><b>Reduce motion</b><div className="hint">Turn off animations and transitions such as panels sliding and modals scaling. Masar also follows your operating system setting.</div></div>
          <label className="switch" title="Reduce motion"><input type="checkbox" aria-label="Reduce motion" checked={!!p.reduceMotion} onChange={(e) => savePrefs({ reduceMotion: e.target.checked })} /><span /></label>
        </div>
        <div className="pref-row">
          <div><b>Start of the week</b><div className="hint">Used by the calendar and timesheet.</div></div>
          <select className="text-input" style={{ width: 140 }} value={p.weekStart} onChange={(e) => savePrefs({ weekStart: e.target.value })} aria-label="Start of the week">
            <option value="saturday">Saturday</option><option value="sunday">Sunday</option><option value="monday">Monday</option>
          </select>
        </div>

        <hr />
        <h3 className="section-title">Notifications</h3>
        <p className="muted" style={{ marginTop: 0 }}>Choose which in-app notifications you receive. Automation rules never notify you about their own changes.</p>
        {NOTIFY.map((n) => (
          <div className="pref-row" key={n.id}>
            <div><b>{n.label}</b><div className="hint">{n.hint}</div></div>
            <label className="switch" title={n.label}><input type="checkbox" aria-label={n.label} data-notify={n.id} checked={p.notify?.[n.id] !== false}
              onChange={(e) => savePrefs({ notify: { [n.id]: e.target.checked } })} /><span /></label>
          </div>
        ))}
      </div>
      <div className="modal-footer"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  )
}
