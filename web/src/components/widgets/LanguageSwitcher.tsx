import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TranslateRounded from '@mui/icons-material/TranslateRounded'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '@/store/uiStore'
import { applyDocumentLocale } from '@/i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const [el, setEl] = useState<null | HTMLElement>(null)

  const pick = (lng: 'en' | 'ar') => {
    setLanguage(lng)
    void i18n.changeLanguage(lng)
    applyDocumentLocale(lng)
    setEl(null)
  }

  return (
    <>
      <IconButton onClick={(e) => setEl(e.currentTarget)} aria-label={t('app.language')} aria-haspopup="menu">
        <TranslateRounded />
      </IconButton>
      <Menu anchorEl={el} open={Boolean(el)} onClose={() => setEl(null)}>
        <MenuItem selected={language === 'en'} onClick={() => pick('en')}>
          English
        </MenuItem>
        <MenuItem selected={language === 'ar'} onClick={() => pick('ar')}>
          العربية
        </MenuItem>
      </Menu>
    </>
  )
}
