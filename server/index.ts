import createShopifyAuth, { verifyRequest } from '@shopify/koa-shopify-auth'
import Shopify, { ApiVersion } from '@shopify/shopify-api'
import dotenv from 'dotenv'
import Koa from 'koa'
import next from 'next'
import Router from 'koa-router'

dotenv.config()

const { PORT, NODE_ENV, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, HOST } =
  process.env as any

const port = parseInt(PORT, 10) || 8081
const dev = NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

Shopify.Context.initialize({
  API_KEY: SHOPIFY_API_KEY,
  API_SECRET_KEY: SHOPIFY_API_SECRET,
  API_VERSION: ApiVersion.October20,
  HOST_NAME: HOST.replace(/https:\/\//, ''),
  IS_EMBEDDED_APP: true,
  SCOPES: SCOPES.split(','),
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
})

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS: {
  [shop: string]: string
} = {}

app.prepare().then(async () => {
  const server = new Koa()
  const router = new Router()

  server.keys = [Shopify.Context.API_SECRET_KEY]
  server.use(
    createShopifyAuth({
      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify
        const host = ctx.query.host
        const topic = 'APP_UNINSTALLED'
        const path = '/webhooks'
        ACTIVE_SHOPIFY_SHOPS[shop] = scope

        let response = await Shopify.Webhooks.Registry.register({
          accessToken,
          path,
          shop,
          topic,
          webhookHandler: async (
            _topic: any,
            shop: string | number,
            _body: any,
          ) => {
            if (shop && ACTIVE_SHOPIFY_SHOPS[shop]) {
              delete ACTIVE_SHOPIFY_SHOPS[shop]
            }
          },
        })

        if (!response.success) {
          console.log(
            `Failed to register APP_UNINSTALLED webhook: ${response.result}`,
          )
        }

        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`)
      },
    }),
  )

  const handleRequest = async (
    ctx: Koa.ParameterizedContext<
      any,
      Router.IRouterParamContext<any, {}>,
      any
    >,
  ) => {
    await handle(ctx.req, ctx.res)
    ctx.respond = false
    ctx.res.statusCode = 200
  }

  router.post('/webhooks', async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res)
      console.log(`Webhook processed, returned status code 200`)
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`)
    }
  })

  router.post(
    '/graphql',
    verifyRequest({ returnHeader: true }),
    async (ctx, _next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res)
    },
  )

  router.get('(/_next/static/.*)', handleRequest) // Static content is clear
  router.get('/_next/webpack-hmr', handleRequest) // Webpack content is clear
  router.get('(.*)', async (ctx) => {
    let shop = ctx.query.shop

    if (Array.isArray(shop)) shop = shop[0]

    // This shop hasn't been seen yet, go through OAuth to create a session
    if (!shop || ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      ctx.redirect(`/auth?shop=${shop}`)
    } else {
      await handleRequest(ctx)
    }
  })

  server.use(router.allowedMethods())
  server.use(router.routes())
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
