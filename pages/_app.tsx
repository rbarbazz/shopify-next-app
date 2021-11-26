import '@shopify/polaris/build/esm/styles.css'
import type { AppProps } from 'next/app'
import { AppProvider } from '@shopify/polaris'
import translations from '@shopify/polaris/locales/en.json'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppProvider i18n={translations}>
      <Component {...pageProps} />{' '}
    </AppProvider>
  )
}

export default MyApp
