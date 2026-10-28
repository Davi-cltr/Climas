import { useI18n } from '../i18n/useI18n'
import { Mark } from './Header'
import s from '../App.module.css'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className={s.footer}>
      <div className={s.footerBrand}>
        <Mark size={20} />
        <span>CLIMAS</span>
      </div>
      <p>
        {t.dataSource}:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0). Mapa:{' '}
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        ,{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
        .
      </p>
      <p className={s.footerNote}>{t.footerNote}</p>
    </footer>
  )
}
