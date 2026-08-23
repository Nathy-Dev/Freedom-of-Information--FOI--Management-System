import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Route changes start at the top of the page. Anchored navigations (?tab=…) are
 * left alone so switching tabs on a long case file does not lose your place.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Inside the shell it is `#main-content` that scrolls, not the document; the
    // sign-in screens scroll the document. Reset whichever one is in play.
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}
